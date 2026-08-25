import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import keytar from "keytar";
import { CompanyTypes, SCRAPERS, createScraper } from "israeli-bank-scrapers";

const VERSION = "0.1.0";
const APP_DIR = path.join(os.homedir(), ".tabro-finance-connector");
const CONFIG_PATH = path.join(APP_DIR, "config.json");
const KEYCHAIN_SERVICE = "Tabro Finance Connector";
const CONNECTOR_TOKEN_ACCOUNT = "connector-token";
const CARD_LIKE = new Set(["isracard", "amex", "visaCal", "max", "beyahadBishvilha", "behatsdaa"]);

const args = process.argv.slice(2);
const command = args[0] || "help";

function argument(name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
}

async function loadConfig() {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  } catch {
    throw new Error("Connector is not paired. Run npm run setup with the command shown in Tabro.");
  }
}

async function saveConfig(config) {
  await fs.mkdir(APP_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function prompt(question, hidden = false) {
  if (!hidden || !process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
  }

  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let value = "";
    const onData = (character) => {
      if (character === "\r" || character === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (character === "\u0003") {
        process.exit(130);
      } else if (character === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function connectorToken() {
  const token = await keytar.getPassword(KEYCHAIN_SERVICE, CONNECTOR_TOKEN_ACCOUNT);
  if (!token) throw new Error("Pairing token is missing from the operating-system keychain. Run setup again.");
  return token;
}

async function request(action, payload = {}) {
  const config = await loadConfig();
  const token = await connectorToken();
  const response = await fetch(`${config.supabaseUrl}/functions/v1/finance-local-connector`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "x-connector-token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Tabro returned HTTP ${response.status}`);
  return body;
}

async function heartbeat(config) {
  return request("heartbeat", {
    platform: `${os.platform()} ${os.release()}`,
    version: VERSION,
    providers: config.sources,
  });
}

async function setup() {
  const supabaseUrl = argument("url");
  const anonKey = argument("key");
  const token = argument("token");
  if (!supabaseUrl || !anonKey || !token) throw new Error("Missing --url, --key or --token. Copy the full setup command from Tabro.");
  if (!/^https:\/\/.+\.supabase\.co$/.test(supabaseUrl)) throw new Error("Unexpected Supabase URL");
  await saveConfig({ supabaseUrl, anonKey, sources: [] });
  await keytar.setPassword(KEYCHAIN_SERVICE, CONNECTOR_TOKEN_ACCOUNT, token);
  const config = await loadConfig();
  await heartbeat(config);
  console.log("Tabro connector paired successfully. Next: npm run add-source");
}

async function addSource() {
  const config = await loadConfig();
  const entries = Object.entries(SCRAPERS).filter(([id]) => id !== CompanyTypes.oneZero);
  console.log("\nSupported sources:\n");
  entries.forEach(([id, metadata], index) => console.log(`${index + 1}. ${metadata.name} (${id})`));
  console.log("\nConsumer clubs: Beyahad Bishvilha and Behatsdaa\n");
  const selected = Number(await prompt("Choose a source number: ")) - 1;
  const entry = entries[selected];
  if (!entry) throw new Error("Invalid source selection");
  const [companyId, metadata] = entry;
  const credentials = {};
  for (const field of metadata.loginFields.filter((field) => !["otpCodeRetriever", "otpLongTermToken"].includes(field))) {
    credentials[field] = await prompt(`${field}: `, field.toLowerCase().includes("password"));
  }
  await keytar.setPassword(KEYCHAIN_SERVICE, `credentials:${companyId}`, JSON.stringify(credentials));
  config.sources = Array.from(new Set([...config.sources, companyId]));
  await saveConfig(config);
  await heartbeat(config);
  console.log(`${metadata.name} added. Credentials are stored in your operating-system keychain.`);
}

async function removeSource() {
  const config = await loadConfig();
  if (!config.sources.length) return console.log("No configured sources.");
  config.sources.forEach((source, index) => console.log(`${index + 1}. ${SCRAPERS[source]?.name || source}`));
  const selected = Number(await prompt("Choose a source number to remove: ")) - 1;
  const companyId = config.sources[selected];
  if (!companyId) throw new Error("Invalid source selection");
  await keytar.deletePassword(KEYCHAIN_SERVICE, `credentials:${companyId}`);
  config.sources = config.sources.filter((source) => source !== companyId);
  await saveConfig(config);
  await heartbeat(config);
  console.log("Source removed.");
}

function normalizeAccount(companyId, metadata, account, index) {
  const accountNumber = String(account.accountNumber || `${companyId}-${index + 1}`);
  const cardLike = CARD_LIKE.has(companyId);
  return {
    external_id: `${companyId}:${accountNumber}`,
    account_type: cardLike ? "CARD" : "CHECKING",
    display_name: metadata.name,
    masked_number: accountNumber ? `•••• ${accountNumber.replace(/\s/g, "").slice(-4)}` : null,
    currency: "ILS",
    balance: Number.isFinite(Number(account.balance)) ? Number(account.balance) : null,
    transactions: (account.txns || []).map((transaction, transactionIndex) => {
      const signed = Number(transaction.chargedAmount ?? transaction.originalAmount ?? 0);
      // The scraper library normalizes debits as negative across account types.
      const direction = signed < 0 ? "expense" : "income";
      const date = new Date(transaction.date || transaction.processedDate || Date.now()).toISOString().slice(0, 10);
      const description = String(transaction.description || transaction.memo || "Imported transaction");
      return {
        external_id: `${companyId}:${accountNumber}:${transaction.identifier || `${date}:${description}:${signed}:${transactionIndex}`}`,
        date,
        processed_date: transaction.processedDate ? new Date(transaction.processedDate).toISOString().slice(0, 10) : null,
        amount: Math.abs(signed),
        currency: transaction.originalCurrency || "ILS",
        direction,
        description,
        merchant: description,
        installment_total: transaction.installments?.total || null,
        installment_number: transaction.installments?.number || null,
        raw_data: { type: transaction.type, memo: transaction.memo, status: transaction.status },
      };
    }),
    raw_data: {},
  };
}

async function syncSource(companyId) {
  const metadata = SCRAPERS[companyId];
  const rawCredentials = await keytar.getPassword(KEYCHAIN_SERVICE, `credentials:${companyId}`);
  if (!metadata || !rawCredentials) throw new Error(`Credentials not found for ${companyId}`);
  const credentials = JSON.parse(rawCredentials);
  const scraper = createScraper({
    companyId,
    startDate: new Date(Date.now() - 365 * 86400000),
    combineInstallments: false,
    showBrowser: false,
  });
  console.log(`Syncing ${metadata.name}...`);
  const result = await scraper.scrape(credentials);
  if (!result.success) throw new Error(`${result.errorType}: ${result.errorMessage || "scraping failed"}`);
  const accounts = result.accounts.map((account, index) => normalizeAccount(companyId, metadata, account, index));
  const response = await request("ingest", { provider: companyId, provider_name: metadata.name, accounts });
  console.log(`${metadata.name}: ${response.transactions_count} new transactions imported.`);
}

async function syncAll() {
  const config = await loadConfig();
  await heartbeat(config);
  for (const companyId of config.sources) {
    try {
      await syncSource(companyId);
    } catch (error) {
      console.error(`${SCRAPERS[companyId]?.name || companyId}: ${error.message}`);
      await request("report_error", { error: `${SCRAPERS[companyId]?.name || companyId}: ${error.message}` }).catch(() => {});
    }
  }
}

async function daemon() {
  console.log("Tabro Finance Connector is running. Press Ctrl+C to stop.");
  while (true) {
    const config = await loadConfig();
    const response = await heartbeat(config);
    await syncAll();
    const minutes = Number(response.sync_interval_minutes) || 360;
    console.log(`Next sync in ${minutes} minutes.`);
    await new Promise((resolve) => setTimeout(resolve, minutes * 60000));
  }
}

async function list() {
  const config = await loadConfig();
  if (!config.sources.length) return console.log("No sources configured.");
  config.sources.forEach((source) => console.log(`- ${SCRAPERS[source]?.name || source}`));
}

function help() {
  console.log(`Tabro Finance Connector ${VERSION}\n\nCommands:\n  npm run setup -- --url ... --key ... --token ...\n  npm run add-source\n  npm run sync\n  npm run daemon\n  npm run install-service\n  npm run list\n  npm run remove-source`);
}

try {
  if (command === "setup") await setup();
  else if (command === "add-source") await addSource();
  else if (command === "remove-source") await removeSource();
  else if (command === "sync") await syncAll();
  else if (command === "daemon") await daemon();
  else if (command === "list") await list();
  else help();
} catch (error) {
  console.error(`Tabro connector error: ${error.message}`);
  process.exitCode = 1;
}
