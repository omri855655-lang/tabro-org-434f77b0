import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve('public/focus-assets');
const records = [];
async function download(file, path) {
  if (!file || file.size > 12_000_000 || new URL(file.url).hostname !== 'dl.polyhaven.org') throw new Error('Unexpected asset');
  const target = resolve(root, path);
  if (!target.startsWith(root + sep)) throw new Error('Invalid asset path');
  const cached = await readFile(target).catch(() => null);
  if (cached?.length === file.size && createHash('md5').update(cached).digest('hex') === file.md5) {
    records.push({path, source:file.url, bytes:cached.length, md5:file.md5});
    return;
  }
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length !== file.size || createHash('md5').update(data).digest('hex') !== file.md5) throw new Error('Asset checksum mismatch');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  records.push({path, source:file.url, bytes:data.length, md5:file.md5});
}
for (const id of ['wooden_display_shelves_01','wooden_table_02','SchoolChair_01','book_encyclopedia_set_01','round_wooden_table_02','WoodenChair_01']) {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`);
  const model = (await response.json()).gltf['1k'].gltf;
  await download(model, `${id}/model.gltf`);
  for (const [path, file] of Object.entries(model.include)) await download(file, `${id}/${path}`);
}
for (const id of ['herringbone_parquet','plastered_wall_02']) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  for (const channel of ['diff','nor_gl']) await download(files.gltf['1k'].gltf.include[`textures/${id}_${channel}_1k.jpg`], `${id}/${channel}.jpg`);
}
const lighting = await (await fetch('https://api.polyhaven.com/files/reading_room')).json();
await download(lighting.hdri['1k'].hdr,'reading_room.hdr');
const outside = await (await fetch('https://api.polyhaven.com/files/forest_slope')).json();
await download(outside.hdri['2k'].hdr,'forest_slope.hdr');
await writeFile(resolve(root,'manifest.json'),JSON.stringify({license:'CC0',licenseUrl:'https://polyhaven.com/license',files:records},null,2)+'\n');
console.log(`${records.length} verified files, ${(records.reduce((sum,file)=>sum+file.bytes,0)/1e6).toFixed(1)} MB`);
