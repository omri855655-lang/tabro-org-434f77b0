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

if (packageJson.version !== "8.7.1") {
  throw new Error(`Unsupported israeli-bank-scrapers version: ${packageJson.version}`);
}

const bundlePath = path.join(path.dirname(packageJsonPath), "lib", "index.mjs");
const source = await readFile(bundlePath, "utf8");
let patchedSource = source;

function replaceOnce(original, replacement, label) {
  if (patchedSource.includes(replacement)) return;
  if (!patchedSource.includes(original)) {
    throw new Error(`Could not find ${label} in the finance scraper bundle`);
  }
  patchedSource = patchedSource.replace(original, replacement);
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
  '{ factory: makeHome, enabled: ifBrowser },',
  '{ factory: makeHome, enabled: (state) => state.hasBrowser && state.options.companyId !== "visaCal" },',
  "Visa Cal home-phase override",
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

if (patchedSource !== source) {
  await writeFile(bundlePath, patchedSource);
}
