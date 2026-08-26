import crypto from "node:crypto";
import process from "node:process";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { createScraper, SCRAPERS } from "israeli-bank-scrapers";

const app = express();
app.disable("x-powered-by");
app.use((request, response, next) => {
  response.set({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  next();
});
app.use(express.json({
  limit: "16kb",
  strict: true,
  verify: (request, _response, buffer) => {
    request.rawBody = Buffer.from(buffer);
  },
}));

const CARD_LIKE = new Set(["isracard", "amex", "visaCal", "max", "beyahadBishvilha", "behatsdaa"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function serviceClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function encryptionKey() {
  const raw = env("FINANCE_CREDENTIALS_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("FINANCE_CREDENTIALS_KEY must be a base64-encoded 32-byte key");
  return key;
}

function encryptCredentials(credentials) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return {
    encrypted_credentials: encrypted.toString("base64"),
    encryption_iv: iv.toString("base64"),
    encryption_tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptCredentials(row) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(row.encryption_iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.encryption_tag, "base64"));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_credentials, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(clear);
}

function safeDate(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function category(description) {
  const value = description.toLowerCase();
  const groups = [
    ["סופר", ["שופרסל", "רמי לוי", "יוחננוף", "ויקטורי", "אושר עד", "קרפור", "סופר", "market", "grocery"]],
    ["אוכל", ["מסעד", "קפה", "ארומה", "מקדונלד", "וולט", "תן ביס", "פיצה", "restaurant", "wolt"]],
    ["דלק", ["פז", "סונול", "דור אלון", "דלק", "yellow", "fuel"]],
    ["תחבורה", ["רכבת", "אגד", "רב קו", "חניה", "פנגו", "כביש 6", "gett", "uber", "parking"]],
    ["דיור", ["שכר דירה", "ועד בית", "ארנונה", "משכנת", "rent", "mortgage"]],
    ["חשבונות", ["חשמל", "מים", "בזק", "סלקום", "פרטנר", "hot", "electric", "telecom"]],
    ["ביטוחים", ["ביטוח", "הראל", "מגדל", "הפניקס", "מנורה", "insurance"]],
    ["קניות", ["amazon", "אמזון", "aliexpress", "איקאה", "zara", "קניון", "terminal x", "ebay", "shein"]],
    ["בריאות", ["סופר פארם", "סופר-פארם", "בית מרקחת", "מכבי", "כללית", "מאוחדת", "pharm"]],
    ["בילויים", ["netflix", "spotify", "נטפליקס", "ספוטיפיי", "קולנוע", "סינמה", "תיאטרון"]],
    ["נסיעות", ["אל על", "ישראייר", "ארקיע", "בוקינג", "איירבנב", "מלון", "booking", "airbnb", "hotel"]],
    ["עמלות ומסים", ["עמלה", "ריבית", "מס הכנסה", "ביטוח לאומי", "commission", "fee", "interest", "tax"]],
    ["העברות", ["העברה", "פייבוקס", "paybox", "transfer", "atm"]],
  ];
  return groups.find(([, words]) => words.some((word) => value.includes(word)))?.[0] || "אחר";
}

function transactionId(companyId, accountNumber, transaction, index) {
  const identity = transaction.identifier || [
    safeDate(transaction.date || transaction.processedDate),
    transaction.description || transaction.memo || "transaction",
    transaction.chargedAmount ?? transaction.originalAmount ?? 0,
    index,
  ].join(":");
  return `${companyId}:${accountNumber}:${identity}`.slice(0, 500);
}

function errorDetails(error) {
  if (error instanceof Error) return { message: error.message, code: error.code || null };
  if (typeof error === "string") return { message: error, code: null };
  if (error && typeof error === "object") {
    const message = error.message || error.errorMessage || error.details || error.errorType;
    return {
      message: typeof message === "string" && message.trim() ? message : "Finance synchronization failed",
      code: typeof error.code === "string" ? error.code : null,
    };
  }
  return { message: "Finance synchronization failed", code: null };
}

function isDuplicateTransactionError(error) {
  const details = errorDetails(error);
  return details.code === "23505"
    || details.message.includes("idx_financial_transactions_dedup")
    || details.message.toLowerCase().includes("duplicate key value");
}

async function insertTransactionsIgnoringDuplicates(service, transactions) {
  let inserted = 0;

  for (let index = 0; index < transactions.length; index += 500) {
    const batch = transactions.slice(index, index + 500);
    const { error } = await service.from("financial_transactions").insert(batch);
    if (!error) {
      inserted += batch.length;
      continue;
    }
    if (!isDuplicateTransactionError(error)) throw error;

    // A concurrent manual/automatic sync can win after the preflight lookup.
    // Retry the rolled-back batch individually and ignore only unique-key races.
    for (const transaction of batch) {
      const { error: transactionError } = await service.from("financial_transactions").insert(transaction);
      if (!transactionError) inserted += 1;
      else if (!isDuplicateTransactionError(transactionError)) throw transactionError;
    }
  }

  return inserted;
}

function normalize(companyId, providerName, account, accountIndex) {
  const accountNumber = String(account.accountNumber || `${companyId}-${accountIndex + 1}`);
  return {
    externalId: `${companyId}:${accountNumber}`,
    accountRow: {
      external_account_id: `${companyId}:${accountNumber}`,
      provider_id: companyId,
      provider_name: providerName,
      account_type: CARD_LIKE.has(companyId) ? "CARD" : account.savingsAccount ? "SAVINGS" : "CHECKING",
      display_name: providerName,
      masked_number: accountNumber ? `•••• ${accountNumber.replace(/\s/g, "").slice(-4)}` : null,
      currency: account.currency || "ILS",
      current_balance: Number.isFinite(Number(account.balance)) ? Number(account.balance) : null,
      raw_data: { balance_date: account.balanceDate || null, card_type: account.cardType || null },
    },
    transactions: (account.txns || []).map((transaction, index) => {
      const signed = Number(transaction.chargedAmount ?? transaction.originalAmount ?? 0);
      const description = String(transaction.description || transaction.memo || "Imported transaction").slice(0, 500);
      return {
        external_transaction_id: transactionId(companyId, accountNumber, transaction, index),
        transaction_date: safeDate(transaction.date || transaction.processedDate),
        posted_date: transaction.processedDate ? safeDate(transaction.processedDate) : null,
        amount: Math.abs(Number.isFinite(signed) ? signed : 0),
        currency: transaction.chargedCurrency || transaction.originalCurrency || "ILS",
        direction: signed < 0 ? "expense" : "income",
        description,
        merchant: description,
        category: transaction.category || category(description),
        installment_total: transaction.installments?.total || null,
        installment_number: transaction.installments?.number || null,
        month_key: safeDate(transaction.date || transaction.processedDate).slice(0, 7),
        raw_data: {
          account_external_id: `${companyId}:${accountNumber}`,
          type: transaction.type,
          memo: transaction.memo || null,
          status: transaction.status,
        },
      };
    }),
  };
}

async function saveCredentials(service, { connectionId, userId, companyId, credentials }) {
  if (credentials) {
    const encrypted = encryptCredentials(credentials);
    const { error } = await service.from("finance_scraper_credentials").upsert({
      connection_id: connectionId,
      user_id: userId,
      company_id: companyId,
      ...encrypted,
    }, { onConflict: "connection_id" });
    if (error) throw error;
    return credentials;
  }

  const { data, error } = await service.from("finance_scraper_credentials")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Encrypted connection credentials were not found");
  if (data.company_id !== companyId) throw new Error("Connection provider mismatch");
  return decryptCredentials(data);
}

async function persistResult(service, context, result) {
  const { userId, connectionId, companyId, providerName } = context;
  const normalized = (result.accounts || []).map((account, index) => normalize(companyId, providerName, account, index));
  const now = new Date().toISOString();

  if (normalized.length) {
    const accountRows = normalized.map(({ accountRow }) => ({
      ...accountRow,
      user_id: userId,
      connection_id: connectionId,
      last_synced_at: now,
    }));
    const { error } = await service.from("financial_accounts").upsert(accountRows, {
      onConflict: "user_id,connection_id,external_account_id",
    });
    if (error) throw error;
  }

  const transactions = normalized.flatMap(({ transactions }) => transactions).map((transaction) => ({
    ...transaction,
    user_id: userId,
    source_type: "cloud_scraper",
    source_connection_id: connectionId,
    provider: providerName,
  }));

  const { data: existing, error: existingError } = await service.from("financial_transactions")
    .select("external_transaction_id")
    .eq("user_id", userId)
    .eq("source_type", "cloud_scraper")
    .eq("source_connection_id", connectionId);
  if (existingError) throw existingError;
  const known = new Set((existing || []).map((item) => item.external_transaction_id));
  const uniqueIncoming = new Map();
  for (const transaction of transactions) {
    if (!uniqueIncoming.has(transaction.external_transaction_id)) {
      uniqueIncoming.set(transaction.external_transaction_id, transaction);
    }
  }
  const newTransactions = [...uniqueIncoming.values()].filter((item) => !known.has(item.external_transaction_id));

  const insertedCount = await insertTransactionsIgnoringDuplicates(service, newTransactions);

  await Promise.all([
    service.from("bank_connections").update({
      status: "active",
      last_sync: now,
      last_error: null,
    }).eq("id", connectionId).eq("user_id", userId),
    service.from("financial_sync_logs").insert({
      user_id: userId,
      connection_id: connectionId,
      provider: providerName,
      sync_started_at: context.startedAt,
      sync_finished_at: now,
      imported_count: insertedCount,
      status: "success",
    }),
  ]);

  return { success: true, accounts_count: normalized.length, transactions_count: insertedCount };
}

function signedRequestAuthorized(request) {
  const timestamp = request.get("x-tabro-timestamp") || "";
  const supplied = request.get("x-tabro-signature") || "";
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > SIGNATURE_TOLERANCE_MS) return false;
  if (!/^[a-f0-9]{64}$/i.test(supplied) || !Buffer.isBuffer(request.rawBody)) return false;

  const expected = crypto
    .createHmac("sha256", env("FINANCE_WORKER_SECRET"))
    .update(`${timestamp}.`)
    .update(request.rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

function validSyncPayload({ userId, connectionId, companyId, credentials }) {
  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(connectionId) || !SCRAPERS[companyId]) return false;
  if (credentials === undefined) return true;
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) return false;
  return Object.entries(credentials).every(([key, value]) => (
    /^[A-Za-z0-9_]{1,40}$/.test(key)
    && typeof value === "string"
    && value.length > 0
    && value.length <= 180
  ));
}

app.get("/health", (_request, response) => response.json({ ok: true, service: "tabro-finance-worker" }));

async function syncConnection({ userId, connectionId, companyId, credentials: submittedCredentials }) {
  const metadata = SCRAPERS[companyId];
  if (!userId || !connectionId || !metadata) throw new Error("Invalid sync request");

  const service = serviceClient();
  const startedAt = new Date().toISOString();

  try {
    const { data: connection, error: connectionError } = await service.from("bank_connections")
      .select("id,user_id,integration_provider,metadata")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .eq("integration_provider", "cloud_scraper")
      .single();
    if (connectionError || !connection) throw new Error("Cloud scraper connection was not found");
    if (connection.metadata?.company_id !== companyId) throw new Error("Cloud scraper provider mismatch");

    const { error: statusError } = await service.from("bank_connections")
      .update({ status: "syncing", last_error: null })
      .eq("id", connectionId)
      .eq("user_id", userId);
    if (statusError) throw statusError;

    const credentials = await saveCredentials(service, {
      connectionId,
      userId,
      companyId,
      credentials: submittedCredentials,
    });
    const scraper = createScraper({
      companyId,
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      combineInstallments: false,
      showBrowser: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      timeout: 45_000,
      defaultTimeout: 45_000,
      navigationRetryCount: 1,
    });
    const result = await scraper.scrape(credentials);
    if (!result.success) throw new Error(`${result.errorType || "SCRAPE_FAILED"}: ${result.errorMessage || "The institution rejected the sync"}`);

    const summary = await persistResult(service, {
      userId,
      connectionId,
      companyId,
      providerName: metadata.name,
      startedAt,
    }, result);
    return summary;
  } catch (error) {
    const details = errorDetails(error);
    const message = details.message.slice(0, 500);
    console.error("finance sync failed", { connectionId, companyId, message, code: details.code });
    await Promise.all([
      service.from("bank_connections").update({ status: "error", last_error: message }).eq("id", connectionId).eq("user_id", userId),
      service.from("financial_sync_logs").insert({
        user_id: userId,
        connection_id: connectionId,
        provider: metadata.name,
        sync_started_at: startedAt,
        sync_finished_at: new Date().toISOString(),
        imported_count: 0,
        status: "error",
        error_message: message,
      }),
    ]);
    throw new Error(message);
  }
}

app.post("/sync", async (request, response) => {
  if (!request.is("application/json")) return response.status(415).json({ error: "JSON request required" });
  if (!signedRequestAuthorized(request)) return response.status(401).json({ error: "Unauthorized worker request" });

  const payload = {
    userId: String(request.body.userId || ""),
    connectionId: String(request.body.connectionId || ""),
    companyId: String(request.body.companyId || ""),
    credentials: request.body.credentials,
  };
  if (!validSyncPayload(payload)) return response.status(400).json({ error: "Invalid sync request" });

  try {
    const result = await syncConnection(payload);
    return response.json(result);
  } catch (error) {
    return response.status(502).json({ error: errorDetails(error).message });
  }
});

app.post("/sync-due", async (request, response) => {
  if (!request.is("application/json")) return response.status(415).json({ error: "JSON request required" });

  const service = serviceClient();
  const limit = Math.min(Math.max(Number(request.body.limit || 10), 1), 25);
  const { data: connections, error } = await service.from("bank_connections")
    .select("id,user_id,last_sync,metadata")
    .eq("integration_provider", "cloud_scraper")
    .eq("status", "active")
    .order("last_sync", { ascending: true, nullsFirst: true })
    .limit(limit * 3);
  if (error) return response.status(500).json({ error: error.message });

  const now = Date.now();
  const due = (connections || []).filter((connection) => {
    const interval = Math.max(Number(connection.metadata?.sync_interval_minutes || 360), 60);
    const lastSync = connection.last_sync ? new Date(connection.last_sync).getTime() : 0;
    return !lastSync || now - lastSync >= interval * 60_000;
  }).slice(0, limit);

  const results = [];
  for (const connection of due) {
    try {
      const summary = await syncConnection({
        userId: connection.user_id,
        connectionId: connection.id,
        companyId: String(connection.metadata?.company_id || ""),
      });
      results.push({ connectionId: connection.id, success: true, ...summary });
    } catch (syncError) {
      results.push({
        connectionId: connection.id,
        success: false,
        error: syncError instanceof Error ? syncError.message : "Finance sync failed",
      });
    }
  }

  return response.json({ success: true, checked: connections?.length || 0, synced: results.length, results });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, "0.0.0.0", () => console.log(`Tabro finance worker listening on ${port}`));
