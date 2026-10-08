const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { releaseVersion } = require('../scripts/prepare-pwa.cjs');

const root = resolve(__dirname, '..');
const source = readFileSync(resolve(root, 'sw.js'), 'utf8');
const scope = 'https://example.com/glissando/';

function worker(clients = [{ id: 'solo', url: scope }]) {
  const events = {};
  const cache = new Map();
  const deleted = [];
  const state = { skips: 0, claimed: 0, requests: [], deleted };
  const cached = { match: async key => cache.get(typeof key === 'string' ? key : key.url), addAll: async requests => { state.requests = requests; } };
  runInNewContext(source, {
    URL, Request, Date, Number,
    self: {
      registration: { scope },
      addEventListener: (name, fn) => events[name] = fn,
      skipWaiting: async () => state.skips++,
      clients: { matchAll: async () => clients, claim: async () => state.claimed++ },
    },
    caches: {
      open: async name => { state.cacheName = name; return cached; },
      keys: async () => [`glissando:${scope}:old`, `glissando:${scope}:${releaseVersion()}`, 'unrelated-cache', 'glissando:https://example.com/another/:old'],
      delete: async name => deleted.push(name),
    },
    fetch: async request => ({ network: request.url }),
  });
  return { events, cache, state };
}

test('manifest and icons work under GitHub Pages project scope', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(new URL(manifest.start_url, scope).href, scope);
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  for (const size of [180, 192, 512]) {
    const png = readFileSync(resolve(root, `icons/icon-${size}.png`));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test('offline release fingerprint includes all app assets and worker changes', () => {
  assert.ok(source.includes(`const VERSION = '${releaseVersion()}';`), 'Run npm run prepare:pwa after editing app assets.');
});

test('installation bypasses HTTP cache and does not replace a playing release', async () => {
  const { events, state } = worker();
  let work;
  events.install({ waitUntil: promise => work = promise });
  await work;
  assert.equal(state.requests.length, 5);
  assert.ok(state.requests.every(request => request.cache === 'reload' && request.url.startsWith(scope)));
  assert.equal(state.skips, 0);
});

test('offline status confirms all assets, not just an active worker', async () => {
  const { events, cache } = worker();
  const assets = ['index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
  for (const file of assets) cache.set(scope + file, 'cached response');
  async function probe() {
    let work, reply;
    events.message({ data: { type: 'OFFLINE_STATUS' }, ports: [{ postMessage: value => reply = value }], waitUntil: promise => work = promise });
    await work;
    return reply;
  }
  assert.equal(await probe(), true);
  cache.delete(scope + 'icons/icon-512.png');
  assert.equal(await probe(), false);
});

test('activation removes only this app scope old releases', async () => {
  const { events, state } = worker();
  let work;
  events.activate({ waitUntil: promise => work = promise });
  await work;
  assert.deepEqual(state.deleted, [`glissando:${scope}:old`]);
  assert.equal(state.claimed, 1);
});

test('explicit update refuses other windows, unknown sources and expired requests', async () => {
  for (const [clients, id, expires, expected] of [
    [[{ id: 'solo', url: scope }], 'solo', Date.now() + 30000, 'activating'],
    [[{ id: 'solo', url: scope }, { id: 'other', url: scope }], 'solo', Date.now() + 30000, 'other-tabs'],
    [[{ id: 'solo', url: scope }], 'unknown', Date.now() + 30000, 'other-tabs'],
    [[{ id: 'solo', url: scope }], 'solo', 0, 'expired'],
  ]) {
    const { events, state } = worker(clients);
    let work, reply;
    events.message({ data: { type: 'ACTIVATE_WHEN_SOLO', expires }, source: { id }, ports: [{ postMessage: value => reply = value }], waitUntil: promise => work = promise });
    await work;
    assert.equal(reply, expected);
    assert.equal(state.skips, expected === 'activating' ? 1 : 0);
  }
});

test('offline navigation uses the pinned release and does not intercept editor or external traffic', async () => {
  const { events, cache } = worker();
  cache.set(scope + 'index.html', 'offline HTML');
  for (const suffix of ['', 'index.html', '?source=homescreen']) {
    let response;
    events.fetch({ request: { url: scope + suffix, method: 'GET', mode: 'navigate' }, respondWith: value => response = value });
    assert.equal(await response, 'offline HTML');
  }
  for (const [url, mode] of [
    [scope + 'glissando-text-editor.html', 'navigate'],
    [scope + 'index.html?copyEditor=123', 'cors'],
    [scope + 'sw.js', 'same-origin'],
    ['https://example.com/other/', 'navigate'],
    ['https://www.clarity.ms/tag/test', 'no-cors'],
  ]) {
    let intercepted = false;
    events.fetch({ request: { url, method: 'GET', mode }, respondWith: () => intercepted = true });
    assert.equal(intercepted, false, url);
  }
});
