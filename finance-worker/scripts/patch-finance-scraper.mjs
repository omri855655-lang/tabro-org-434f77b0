import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = path.join(
  projectRoot,
  "node_modules",
  "@sergienko4",
  "israeli-bank-scrapers",
  "package.json",
);
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

if (packageJson.version !== "8.7.4") {
  throw new Error(`Unsupported israeli-bank-scrapers version: ${packageJson.version}`);
}

const bundlePath = path.join(path.dirname(packageJsonPath), "lib", "index.mjs");
const source = await readFile(bundlePath, "utf8");
let patchedSource = source;

function replaceOnce(original, replacement, label) {
  if (patchedSource.includes(replacement)) return;
  const found = (Array.isArray(original) ? original : [original]).find((candidate) => patchedSource.includes(candidate));
  if (!found) {
    throw new Error(`Could not find ${label} in the finance scraper bundle`);
  }
  patchedSource = patchedSource.replace(found, replacement);
}

replaceOnce(
  [
    "async function launchBrowser(options) {",
    "  const opts = options;",
    "  const isHeadless = !opts.shouldShowBrowser;",
  ].join("\n"),
  [
    "async function launchBrowser(options) {",
    "  const opts = options;",
    "  if (\"browser\" in opts) return opts.browser;",
    "  const isHeadless = !opts.shouldShowBrowser;",
  ].join("\n"),
  "browser launcher",
);
replaceOnce(
  [
    '{ factory: makeHome, enabled: ifBrowser },',
    '{ factory: makeHome, enabled: (state) => state.hasBrowser && state.options.companyId !== "visaCal" },',
    '{ factory: makeHome, enabled: (state) => state.hasBrowser && !["visaCal", "discount"].includes(state.options.companyId) },',
  ],
  '{ factory: makeHome, enabled: (state) => state.hasBrowser && !["visaCal", "discount", "amex"].includes(state.options.companyId) },',
  "direct login home-phase override",
);
replaceOnce(
  '["visaCal" /* VisaCal */]: calConfig("https://www.cal-online.co.il/"),',
  '["visaCal" /* VisaCal */]: calConfig("https://digital-web.cal-online.co.il/"),',
  "Visa Cal pipeline URL",
);
replaceOnce(
  'var VISACAL_LOGIN = {\n  loginUrl: "https://www.cal-online.co.il/",',
  'var VISACAL_LOGIN = {\n  loginUrl: "https://digital-web.cal-online.co.il/",',
  "Visa Cal login URL",
);
replaceOnce(
  '["discount" /* Discount */]: defineBank("https://www.discountbank.co.il", ACCOUNT, SESSION_COOKIE),',
  '["discount" /* Discount */]: defineBank("https://start.telebank.co.il/login/", ACCOUNT, SESSION_COOKIE),',
  "Discount pipeline URL",
);
replaceOnce(
  'var DISCOUNT_LOGIN = {\n  loginUrl: "https://www.discountbank.co.il",',
  'var DISCOUNT_LOGIN = {\n  loginUrl: "https://start.telebank.co.il/login/",',
  "Discount login URL",
);
replaceOnce(
  'var AMEX_LOGIN = {\n  loginUrl: "",',
  'var AMEX_LOGIN = {\n  loginUrl: "https://he.americanexpress.co.il/personalarea/login/",',
  "American Express direct login URL",
);
replaceOnce(
  '["amex" /* Amex */]: {\n    urls: { base: "https://www.americanexpress.co.il" },',
  '["amex" /* Amex */]: {\n    urls: { base: "https://he.americanexpress.co.il/personalarea/login/" },',
  "American Express initial browser navigation",
);
replaceOnce(
  "return createPipelineBuilder().withOptions(options).withBrowser().withDeclarativeLogin(AMEX_LOGIN).withPreLogin().withBrowserApiDirect(AMEX_SHAPE).build();",
  "return createPipelineBuilder().withOptions(options).withBrowser().withDeclarativeLogin(AMEX_LOGIN).withBrowserApiDirect(AMEX_SHAPE).build();",
  "American Express dynamic login pre-gate",
);

const amexLoginBlock = patchedSource.match(/var AMEX_LOGIN = \{[\s\S]*?\n\};/)?.[0];
if (!amexLoginBlock) throw new Error("American Express login configuration not found");
const configuredAmexLogin = `var AMEX_LOGIN = {
  loginUrl: "https://he.americanexpress.co.il/personalarea/login/",
  preAction: async (page) => {
    const loginUrl = "https://he.americanexpress.co.il/personalarea/login/";
    if (!page.url().startsWith(loginUrl)) {
      await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    }
    await page.locator("#otpLoginPwd, #flip").first().waitFor({ state: "attached", timeout: 30000 });
    if (!(await page.locator("#otpLoginPwd").isVisible())) {
      await page.locator("#flip").click({ timeout: 15000 });
    }
    await page.locator("#otpLoginPwd").waitFor({ state: "visible", timeout: 30000 });
  },
  fields: [
    { credentialKey: "id", selectors: [{ kind: "css", value: "#otpLoginId_ID" }] },
    { credentialKey: "password", selectors: [{ kind: "css", value: "#otpLoginPwd" }] },
    { credentialKey: "card6Digits", selectors: [{ kind: "css", value: "#cardnum" }] }
  ],
  submit: [{ kind: "css", value: "#otpLobbyFormPassword button[type=submit]" }],
  possibleResults: { success: ["https://he.americanexpress.co.il/personalarea/dashboard/", "https://web.americanexpress.co.il/transactions"] }
};`;
patchedSource = patchedSource.replace(amexLoginBlock, configuredAmexLogin);

if (patchedSource !== source) {
  await writeFile(bundlePath, patchedSource);
}
