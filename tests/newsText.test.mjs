import assert from 'node:assert/strict';
import test from 'node:test';
import { newsText } from '../src/lib/newsText.ts';

test('feed entities are readable without parsing or executing HTML', () => {
  assert.equal(newsText('It&#8217;s &quot;good&quot; &amp; hopeful'), 'It’s "good" & hopeful');
  assert.equal(newsText('<p>News&nbsp;today</p>'), 'News today');
  assert.equal(newsText('&#x1F31E;'), '🌞');
  assert.equal(newsText('&#99999999; &#xD800;'), '&#99999999; &#xD800;');
});
