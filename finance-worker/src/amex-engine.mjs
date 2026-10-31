const ORIGIN = "https://he.americanexpress.co.il";
const SAFE_ERRORS = new Set(["INVALID_PASSWORD", "CHANGE_PASSWORD", "TIMEOUT", "ACCOUNT_BLOCKED", "TWO_FACTOR_AUTH_REQUIRED"]);
const RESOURCE_TYPES = new Set(["document", "xhr", "fetch", "script", "stylesheet", "image", "font"]);

function requestStage(url) {
  if (/^\/personalarea\/login\/?$/i.test(url.pathname)) return "login-page";
  if (url.pathname.toLowerCase() === "/services/proxyrequesthandler.ashx") {
    if (url.searchParams.get("reqName") === "ValidateIdData") return "identity-validation";
    if (url.searchParams.get("reqName") === "performLogonI") return "password-login";
    return "issuer-api";
  }
  return "other-resource";
}

function blockedResult(state) {
  const detail = state.blockDetail;
  return { success: false, errorType: "WAF_BLOCKED", errorMessage: detail
    ? `Amex HTTP_${detail.status}; stage=${detail.stage}; resource=${detail.resource}; password_request=${detail.passwordRequestObserved ? "observed" : "not-observed"}`
    : "Amex blocked this connection before sync completed" };
}

export function engineForProvider(companyId, amexEngine = "official") {
  if (companyId !== "amex") return "existing";
  if (!["official", "legacy"].includes(amexEngine)) throw new Error("Invalid FINANCE_AMEX_ENGINE configuration");
  return amexEngine === "official" ? "official-amex" : "existing";
}

export async function protectAmexPage(page, state) {
  await page.setRequestInterception(true);
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === ORIGIN && [403, 429].includes(response.status())) {
      state.blocked = true;
      const resource = response.request?.()?.resourceType?.();
      // Keep only allowlisted labels, never URLs, query values, bodies or headers.
      state.blockDetail ??= { status: response.status(), stage: requestStage(url),
        resource: RESOURCE_TYPES.has(resource) ? resource : "other",
        passwordRequestObserved: Boolean(state.passwordRequestObserved) };
    }
  });
  page.on("request", request => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    const origin = url.origin;
    const sensitive = !["GET", "HEAD", "OPTIONS"].includes(request.method());
    const untrustedNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame() && origin !== ORIGIN;
    if ((sensitive && (state.blocked || origin !== ORIGIN)) || untrustedNavigation) {
      // External telemetry stays blocked, but is not itself a login redirect.
      state.untrusted ||= untrustedNavigation;
      void request.abort("blockedbyclient", 1000).catch(() => undefined);
    } else {
      // Observation is not proof that the request was sent or the password was checked.
      if (sensitive && origin === ORIGIN && requestStage(url) === "password-login") state.passwordRequestObserved = true;
      // Cooperate with the official library's request handlers, without changing other providers.
      void request.continue({}, -100).catch(() => undefined);
    }
  });
}

async function loadOfficialEngine() {
  const { createScraper } = await import("israeli-bank-scrapers");
  const { default: puppeteer } = await import("puppeteer");
  return { createScraper, launch: options => puppeteer.launch(options) };
}

export async function scrapeOfficialAmex(credentials, { executablePath, loadEngine = loadOfficialEngine, timeoutMs = 180_000 } = {}) {
  if (!executablePath) throw new Error("FINANCE_BROWSER_EXECUTABLE is not configured");
  if (!credentials?.id || !credentials?.password || !credentials?.card6Digits) {
    return { success: false, errorType: "INVALID_INPUT", errorMessage: "Amex credentials are incomplete" };
  }
  const engine = await loadEngine();
  const browser = await engine.launch({ executablePath, headless: true, timeout: 60_000, args: ["--disable-dev-shm-usage", "--no-sandbox"] });
  const state = { blocked: false, untrusted: false };
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async () => { const page = await newPage(); await protectAmexPage(page, state); return page; };
  let timer;
  try {
    const scraper = engine.createScraper({ companyId: "amex", browser, skipCloseBrowser: true,
      startDate: new Date(Date.now() - 365 * 86400000), timeout: 60_000,
      combineInstallments: false, futureMonthsToScrape: 1,
      additionalTransactionInformation: false, showBrowser: false });
    const result = await Promise.race([
      scraper.scrape({ id: credentials.id, password: credentials.password, card6Digits: credentials.card6Digits }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("AMEX_TIMEOUT")), timeoutMs); }),
    ]);
    if (state.untrusted) return { success: false, errorType: "LOGIN_UNTRUSTED_REDIRECT", errorMessage: "Amex login stopped on an untrusted origin" };
    if (state.blocked) return blockedResult(state);
    if (!result?.success) return { success: false, errorType: SAFE_ERRORS.has(result?.errorType) ? result.errorType : "AMEX_LOGIN_FAILED", errorMessage: "The official Amex connection did not complete" };
    if (!Array.isArray(result.accounts) || !result.accounts.length) return { success: false, errorType: "AMEX_NO_ACCOUNTS", errorMessage: "No Amex accounts returned; existing data was not changed" };
    return result;
  } catch (error) {
    if (state.blocked && !state.untrusted) return blockedResult(state);
    return { success: false, errorType: state.untrusted ? "LOGIN_UNTRUSTED_REDIRECT" : state.blocked ? "WAF_BLOCKED" : error?.message === "AMEX_TIMEOUT" ? "TIMEOUT" : "AMEX_LOGIN_FAILED", errorMessage: "The official Amex connection did not complete; existing data was not changed" };
  } finally {
    clearTimeout(timer);
    await browser.close().catch(() => undefined);
  }
}
