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
  // Resolve the literal theme declarations; browser tests cover the actual CSS cascade.
  const tokens = {};
  for (const skin of ['original', 'chroma', 'chroma-dark']) {
    const block = html.match(new RegExp(`\\[data-skin="${skin}"\\] \\{([^}]+)\\}`))[1];
    tokens[skin] = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  }
  const appearance = runInNewContext(`${source}\nAppearance`, {
    document: { documentElement: root, querySelector: () => meta },
    getComputedStyle: () => ({ getPropertyValue: name => tokens[root.dataset.skin]?.[name] || '' }),
    localStorage: {
      getItem(key) { assert.equal(key, 'glissando.skin'); if (blocked) throw Error('denied'); return saved; },
      setItem(key, value) { if (blocked) throw Error('denied'); writes.push([key, value]); },
    },
  });
  return { appearance, root, meta, writes };
}

test('skin defaults safely and restores a validated saved choice before paint', () => {
  for (const saved of [null, '', 'unknown', 'original', 'toString', '__proto__']) {
    assert.equal(boot(saved).root.dataset.skin, 'original');
  }
  const { root, meta, writes } = boot('chroma');
  assert.equal(root.dataset.skin, 'chroma');
  assert.equal(root.style.colorScheme, 'light');
  assert.equal(meta.content, '#f0f1f2');
  assert.equal(writes.length, 0);
  assert.ok(html.indexOf('const Appearance') < html.indexOf('<style>'));
});

test('dark Chroma restores its family, browser chrome and CSS-driven canvas colors', () => {
  const { root, meta, appearance } = boot('chroma-dark');
  assert.equal(root.dataset.skin, 'chroma-dark');
  assert.equal(root.dataset.design, 'chroma');
  assert.equal(root.style.colorScheme, 'dark');
  assert.equal(meta.content, '#18191b');
  assert.equal(appearance.isChroma, true);
  assert.equal(appearance.color('#ff7a59'), '#7fa9ff');
  assert.equal(appearance.paint.ink, '#f1f2f4');
  appearance.apply('chroma');
  assert.equal(appearance.paint.ink, '#171717');
  appearance.apply('original');
  assert.equal(appearance.isChroma, false);
});

test('both Chroma themes define the same tokens without duplicating component rules', () => {
  function names(skin) {
    const block = html.match(new RegExp(`\\[data-skin="${skin}"\\] \\{([^}]+)\\}`))[1];
    return [...block.matchAll(/(--[\w-]+):/g)].map(m => m[1]).sort();
  }
  assert.deepEqual(names('chroma'), names('chroma-dark'));
  assert.ok(names('chroma').length >= 30);
  assert.doesNotMatch(html, /\[data-skin="chroma-dark"\]\s+\S+\s*\{/);
});

test('skin changes persist only appearance and restore the original browser chrome', () => {
  const { appearance, root, meta, writes } = boot(null);
  appearance.apply('chroma', true);
  appearance.apply('chroma-dark', true);
  appearance.apply('original', true);
  assert.deepEqual(writes, [['glissando.skin', 'chroma'], ['glissando.skin', 'chroma-dark'], ['glissando.skin', 'original']]);
  assert.equal(root.style.colorScheme, 'dark');
  assert.equal(meta.content, '#0a0d12');
});

test('unavailable storage does not prevent choosing a skin or starting the app', () => {
  const { appearance, root } = boot(null, true);
  assert.equal(appearance.current, 'original');
  appearance.apply('chroma', true);
  assert.equal(root.dataset.skin, 'chroma');
  appearance.apply('chroma-dark', true);
  assert.equal(root.dataset.skin, 'chroma-dark');
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
