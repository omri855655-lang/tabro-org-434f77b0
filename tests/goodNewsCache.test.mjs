import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeNewsItems,readNewsCache,GOOD_NEWS_CACHE_KEY} from '../src/lib/goodNewsCache.ts';
import {goodNewsCopy} from '../src/lib/goodNewsCopy.ts';
import {newsFeedItems} from '../supabase/functions/_shared/news-feed.ts';
const article={title:'A &amp; B',source:'Source',link:'https://example.com/story',pubDate:'2026-10-21',description:'<p>Good news</p>'};
test('last-known news cache survives a calendar-day rollover without pretending it was refreshed',()=>{
  const savedAt=Date.parse('2026-10-20T10:00:00Z');const cache=readNewsCache({items:[article],savedAt});
  assert.equal(cache.items.length,1);assert.equal(cache.savedAt,savedAt);assert.ok(!GOOD_NEWS_CACHE_KEY.includes('2026-10-21'));
});
test('cache validates URLs, removes malformed rows and duplicates, and does not create dates',()=>{
  const rows=normalizeNewsItems([article,article,{...article,link:'javascript:alert(1)'},{...article,link:'https://user:pass@example.com'},{...article,link:'https://example.com/other',pubDate:'unknown'}]);
  assert.equal(rows.length,2);assert.equal(rows.find(row=>row.link.endsWith('other')).pubDate,'');assert.equal(rows[0].title,'A & B');
});
test('RSS and Atom alternate links are read without treating objects as strings or unsafe HTML',()=>{
  const atom=newsFeedItems({feed:{entry:[{title:{'#text':'A lesson'},link:[{'@_rel':'self','@_href':'https://example.com/xml'},{'@_rel':'alternate','@_href':'https://example.com/article'}],summary:{'#text':'<b>Safe text</b>'}}]}},'Feed');
  assert.equal(atom[0].link,'https://example.com/article');assert.equal(atom[0].description,'Safe text');
  assert.equal(newsFeedItems({rss:{channel:{item:{title:'Bad',link:'javascript:alert(1)'}}}},'Feed').length,0);
});
test('all six news interfaces have the same complete labels',()=>{
  const keys=Object.keys(goodNewsCopy.en).sort();for(const copy of Object.values(goodNewsCopy)){assert.deepEqual(Object.keys(copy).sort(),keys);assert.ok(Object.values(copy).every(value=>typeof value==='string'&&value));}
});
