import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../public/', import.meta.url);
test('PWA uses a relative origin identity, standalone mode and correctly sized opaque icons', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/personal');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const data = fs.readFileSync(new URL(icon.src.slice(1), root));
    const [width,height] = icon.sizes.split('x').map(Number);
    assert.equal(data.readUInt32BE(16), width);
    assert.equal(data.readUInt32BE(20), height);
    assert.equal(data[25], 2, 'app icons are RGB, not transparent/checkerboard placeholders');
  }
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes('sizes="180x180" href="/icons/tabro-v3-180.png"'));
});
function worker() {
  const listeners = {}, shown = [], opened = [];
  const self = { location:{origin:'https://tabro.org'}, registration:{ async showNotification(title,options){shown.push({title,options});} }, clients:{ async openWindow(url){opened.push(url);}, async claim(){} }, async skipWaiting(){}, addEventListener(name,handler){listeners[name]=handler;} };
  vm.runInNewContext(fs.readFileSync(new URL('sw-push.js',root),'utf8'), {self,URL,console});
  return {listeners,shown,opened};
}
test('push worker always shows a local-branded notification and does not collapse unrelated messages', async () => {
  const {listeners,shown} = worker(); let promise;
  listeners.push({data:{json:()=>({body:'Hello',icon:'https://untrusted.test/tracker'})},waitUntil:p=>promise=p}); await promise;
  assert.equal(shown[0].title,'Tabro');
  assert.equal(shown[0].options.icon,'/icons/tabro-v3-192.png');
  assert.equal(shown[0].options.tag,undefined);
  assert.ok(!listeners.fetch, 'private pages are not cached');
});
test('notification clicks never send the user to an external or malformed target', async () => {
  const {listeners,opened}=worker(); let promise;
  for(const url of ['https://untrusted.test/phishing','/personal?section=email']) {
    listeners.notificationclick({notification:{data:{url},close(){}},waitUntil:p=>promise=p}); await promise;
  }
  assert.equal(opened[0],'https://tabro.org/personal');
  assert.equal(opened[1],'https://tabro.org/personal?section=email');
});
