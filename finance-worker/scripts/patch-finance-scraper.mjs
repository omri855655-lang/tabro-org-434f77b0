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
    '{ factory: makeHome, enabled: (state) => state.hasBrowser && !["visaCal", "discount", "amex"].includes(state.options.companyId) },',
  ],
  '{ factory: makeHome, enabled: (state) => state.hasBrowser && !["visaCal", "discount", "amex", "max", "isracard"].includes(state.options.companyId) },',
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
      const response = await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      if ([403, 429].includes(response?.status())) {
        throw new Error("WAF_BLOCKED: institution refused the login page before credentials were submitted");
      }
    }
    const assertTrustedOrigin = () => {
      const host = new URL(page.url()).hostname;
      if (!["he.americanexpress.co.il", "www.americanexpress.co.il"].includes(host)) {
        throw new Error("LOGIN_UNTRUSTED_REDIRECT: credentials were not submitted");
      }
    };
    assertTrustedOrigin();
    try {
      await page.locator("#otpLoginPwd, #flip").first().waitFor({ state: "attached", timeout: 30000 });
    } catch {
      const pageText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
      if (/access denied|sorry.{0,30}blocked|request rejected|attention required|verify you are human/i.test(pageText)) {
        throw new Error("WAF_BLOCKED: institution refused the login page before credentials were submitted");
      }
      throw new Error("LOGIN_FORM_UNAVAILABLE: credentials were not submitted");
    }
    assertTrustedOrigin();
    if (!(await page.locator("#otpLoginPwd").isVisible())) {
      await page.locator("#flip").click({ timeout: 15000 });
    }
    await page.locator("#otpLoginPwd").waitFor({ state: "visible", timeout: 30000 });
    assertTrustedOrigin();
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

// These official password forms were verified without entering credentials.
const cardLogins = [
  { name: "MAX", company: "Max", id: "max", url: "https://www.max.co.il/login", host: "www.max.co.il", tab: "#login-password-link", password: "#password", username: "#user-name", submit: "#login-password app-user-login-form button.general-button.send-me-code", success: "https://www.max.co.il/homepage/personal" },
  { name: "ISRACARD", company: "Isracard", id: "isracard", url: "https://digital.isracard.co.il/personalarea/Login/", host: "digital.isracard.co.il", tab: "#flip", password: "#otpLoginPwd", username: "#otpLoginId_ID", submit: "#otpLobbyFormPassword button[type=submit]", success: "https://digital.isracard.co.il/personalarea/dashboard/" },
];
for (const card of cardLogins) {
  const oldLogin = patchedSource.match(new RegExp(`var ${card.name}_LOGIN = \\{[\\s\\S]*?\\n\\};`))?.[0];
  if (!oldLogin) throw new Error(`${card.name} login configuration not found`);
  const fields = [
    { credentialKey: card.id === "max" ? "username" : "id", selectors: [{ kind: "css", value: card.username }] },
    { credentialKey: "password", selectors: [{ kind: "css", value: card.password }] },
    ...(card.id === "isracard" ? [{ credentialKey: "card6Digits", selectors: [{ kind: "css", value: "#cardnum" }] }] : []),
  ];
  const configured = `var ${card.name}_LOGIN = {
  loginUrl: ${JSON.stringify(card.url)},
  preAction: async (page) => {
    const trustedHost = ${JSON.stringify(card.host)};
    const assertOrigin = () => {
      const current = new URL(page.url());
      if (current.protocol !== "https:" || current.hostname !== trustedHost) {
        throw new Error("LOGIN_UNTRUSTED_REDIRECT: credentials were not submitted");
      }
    };
    assertOrigin();
    if (!page.url().toLowerCase().startsWith(${JSON.stringify(card.url.toLowerCase())})) {
      const response = await page.goto(${JSON.stringify(card.url)}, { waitUntil: "domcontentloaded", timeout: 45000 });
      if ([403, 429].includes(response?.status())) throw new Error("WAF_BLOCKED: credentials were not submitted");
    }
    assertOrigin();
    const password = page.locator(${JSON.stringify(card.password)});
    if (!(await password.isVisible())) {
      const tab = page.locator(${JSON.stringify(card.tab)});
      try { await tab.waitFor({ state: "visible", timeout: 30000 }); }
      catch { throw new Error("LOGIN_FORM_UNAVAILABLE: credentials were not submitted"); }
      assertOrigin();
      await tab.click({ timeout: 15000 });
    }
    try { await password.waitFor({ state: "visible", timeout: 30000 }); }
    catch { throw new Error("LOGIN_FORM_UNAVAILABLE: credentials were not submitted"); }
    assertOrigin();
  },
  fields: ${JSON.stringify(fields)},
  submit: [{ kind: "css", value: ${JSON.stringify(card.submit)} }],
  possibleResults: { success: [${JSON.stringify(card.success)}] }
};`;
  patchedSource = patchedSource.replace(oldLogin, configured);
  replaceOnce(
    `return createPipelineBuilder().withOptions(options).withBrowser().withDeclarativeLogin(${card.name}_LOGIN).withPreLogin().withBrowserApiDirect(${card.name}_SHAPE).build();`,
    `return createPipelineBuilder().withOptions(options).withBrowser().withDeclarativeLogin(${card.name}_LOGIN).withBrowserApiDirect(${card.name}_SHAPE).build();`,
    `${card.name} password-tab pre-gate`,
  );
}
replaceOnce(
  '...defineBank("https://www.max.co.il", CARD_CYCLE, SESSION_COOKIE),',
  '...defineBank("https://www.max.co.il/login", CARD_CYCLE, SESSION_COOKIE),',
  "MAX official login application",
);
replaceOnce(
  '["isracard" /* Isracard */]: {\n    urls: { base: "https://www.isracard.co.il" },',
  '["isracard" /* Isracard */]: {\n    urls: { base: "https://digital.isracard.co.il/personalarea/Login/" },',
  "Isracard official login application",
);

if (patchedSource !== source) {
  await writeFile(bundlePath, patchedSource);
}
