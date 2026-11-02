import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = (await import(process.env.SHARP_MODULE || require.resolve('sharp'))).default;
const root = fileURLToPath(new URL('../public/', import.meta.url));
const source = await fs.readFile(path.join(root, 'icons/tabro-pencil-v4.png'));
const background = '#FFF9ED';
const logo = await sharp(source).trim({ threshold: 20 }).png().toBuffer();
const metadata = await sharp(source).metadata();
// Small favicons and monochrome badges use only the mark, not illegible lettering.
const markCrop = await sharp(source).extract({ left: 0, top: 0, width: metadata.width, height: Math.floor(metadata.height * .74) }).png().toBuffer();
const mark = await sharp(markCrop).trim({ threshold: 20 }).png().toBuffer();

async function icon(size, content, inset) {
  const inner = await sharp(content).resize(size - inset * 2, size - inset * 2, { fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background } })
    .composite([{ input: inner, gravity: 'centre' }]).removeAlpha().png().toBuffer();
}
for (const size of [180, 192, 512]) {
  await fs.writeFile(path.join(root, `icons/tabro-v4-${size}.png`), await icon(size, logo, Math.round(size * .09)));
}
await fs.writeFile(path.join(root, 'icons/tabro-maskable-v4-512.png'), await icon(512, logo, 100));
await fs.writeFile(path.join(root, 'icons/tabro-v4-32.png'), await icon(32, mark, 3));
await fs.writeFile(path.join(root, 'favicon.png'), await icon(32, mark, 3));
const alpha = await sharp(mark).resize(80, 80, { fit: 'contain', background: '#00000000' }).extractChannel('alpha').toBuffer();
const whiteMark = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#FFFFFF' } }).joinChannel(alpha).png().toBuffer();
await sharp({ create: { width: 96, height: 96, channels: 4, background: '#00000000' } })
  .composite([{ input: whiteMark, gravity: 'centre' }]).png().toFile(path.join(root, 'icons/tabro-badge-v4-96.png'));

// Keep legacy asset URLs aligned for older notification senders and shared links.
for (const name of ['app-icon.png', 'pwa-192x192.png']) await fs.writeFile(path.join(root, name), await icon(192, logo, 17));
await fs.writeFile(path.join(root, 'pwa-512x512.png'), await icon(512, logo, 46));
await fs.writeFile(path.join(root, 'tabro-logo.png'), logo);
await fs.writeFile(path.join(root, '../src/assets/tabro-logo-transparent.png'), logo);
await fs.writeFile(path.join(root, '../src/assets/tabro-logo.png'), await icon(512, logo, 46));
