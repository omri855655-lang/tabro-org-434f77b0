import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, 'node_modules/amex-scraper');
const metadata = JSON.parse(await readFile(path.join(target, 'package.json'), 'utf8'));
if (metadata.version !== '6.12.2') throw new Error('Unsupported isolated Amex dependency version');

const files = {
  'base-isracard.ts': 'lib/scrapers/base-isracard/base-isracard.js',
  'base-isracard-utils.ts': 'lib/scrapers/base-isracard/base-isracard-utils.js',
  'amex.ts': 'lib/scrapers/amex.js',
  'tabro-amex-browser.ts': 'lib/helpers/tabro-amex-browser.js',
  'tabro-amex-fetch.ts': 'lib/helpers/tabro-amex-fetch.js',
};

for (const [source, destination] of Object.entries(files)) {
  const code = await readFile(path.join(root, 'vendor/amex', source), 'utf8');
  const compiled = ts.transpileModule(code, {
    fileName: source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const output = path.join(target, destination);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, compiled.outputText);
}
