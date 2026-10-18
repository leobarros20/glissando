const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>\s*\/\/ Apply the saved appearance[\s\S]*?<\/script>/)[0]
  .replace(/^<script>|<\/script>$/g, '');

function boot(saved, blocked = false) {
  const root = { dataset: {}, style: {} };
  const meta = {};
  const writes = [];
  const appearance = runInNewContext(`${source}\nAppearance`, {
    document: { documentElement: root, querySelector: () => meta },
    localStorage: {
      getItem(key) { assert.equal(key, 'glissando.skin'); if (blocked) throw Error('denied'); return saved; },
      setItem(key, value) { if (blocked) throw Error('denied'); writes.push([key, value]); },
    },
  });
  return { appearance, root, meta, writes };
}

test('skin defaults safely and restores a validated saved choice before paint', () => {
  for (const saved of [null, '', 'unknown', 'original']) {
    assert.equal(boot(saved).root.dataset.skin, 'original');
  }
  const { root, meta, writes } = boot('chroma');
  assert.equal(root.dataset.skin, 'chroma');
  assert.equal(root.style.colorScheme, 'light');
  assert.equal(meta.content, '#f0f1f2');
  assert.equal(writes.length, 0);
  assert.ok(html.indexOf('const Appearance') < html.indexOf('<style>'));
});

test('skin changes persist only appearance and restore the original browser chrome', () => {
  const { appearance, root, meta, writes } = boot(null);
  appearance.apply('chroma', true);
  appearance.apply('original', true);
  assert.deepEqual(writes, [['glissando.skin', 'chroma'], ['glissando.skin', 'original']]);
  assert.equal(root.style.colorScheme, 'dark');
  assert.equal(meta.content, '#0a0d12');
});

test('unavailable storage does not prevent choosing a skin or starting the app', () => {
  const { appearance, root } = boot(null, true);
  assert.equal(appearance.current, 'original');
  appearance.apply('chroma', true);
  assert.equal(root.dataset.skin, 'chroma');
});

test('skin palettes preserve finger identity and leave unknown colors intact', () => {
  const { appearance } = boot(null);
  assert.equal(appearance.color('#ff7a59'), '#ff7a59');
  appearance.apply('chroma');
  assert.equal(appearance.color('#ff7a59'), '#285ddd');
  assert.equal(appearance.color('#ffd166'), '#ee493c');
  assert.equal(appearance.color('#7a8290'), '#7a8290');
  appearance.apply('original');
  assert.equal(appearance.color('#ff7a59'), '#ff7a59');
});
