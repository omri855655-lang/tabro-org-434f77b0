import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = (await import(process.env.SHARP_MODULE || require.resolve('sharp'))).default;
const root = fileURLToPath(new URL('../public/', import.meta.url));
const source = await fs.readFile(path.join(root, 'icons/tabro-rocket-v3.svg'));
for (const size of [180, 192, 512]) {
  await sharp(source).resize(size, size).flatten({ background: '#351B57' }).removeAlpha().png()
    .toFile(path.join(root, `icons/tabro-v3-${size}.png`));
}
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#351B57' } })
  .composite([{ input: await sharp(source).resize(410, 410).toBuffer(), left: 51, top: 51 }])
  .removeAlpha().png().toFile(path.join(root, 'icons/tabro-maskable-v3-512.png'));
const badge = await fs.readFile(path.join(root, 'icons/tabro-badge-v3.svg'), 'utf8');
await sharp(Buffer.from(badge)).png().toFile(path.join(root, 'icons/tabro-badge-v3-96.png'));
const favicon = badge.replace('<g fill="#fff"', '<rect width="96" height="96" fill="#351B57"/><g fill="#FFDA42"');
await sharp(Buffer.from(favicon)).resize(32, 32).removeAlpha().png().toFile(path.join(root, 'icons/tabro-v3-32.png'));
await sharp(source).resize(192, 192).removeAlpha().png().toFile(path.join(root, 'app-icon.png'));
