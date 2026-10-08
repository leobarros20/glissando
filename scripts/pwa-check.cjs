const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('./static-server.cjs');

const out = process.env.GLISSANDO_QA_DIR || resolve(__dirname, '..', '..', '..', 'qa-pwa');
mkdirSync(out, { recursive: true });
let release = 'one';
let breakIcon = false;
const server = createServer({ basePath: '/glissando/', transform(file, body) {
  if (breakIcon && file === 'icons/icon-192.png') throw new Error('Simulated interrupted deployment');
  if (file === 'sw.js') return body.toString().replace(/const VERSION = '([^']+)'/, `const VERSION = '$1-${release}'`);
  if (file === 'index.html') return body.toString().replace('<head>', `<head><meta name="qa-release" content="${release}">`);
  return body;
} });

async function prepare(context) {
  await context.route(/google|clarity\.ms/, route => route.abort());
  await context.addInitScript(() => {
    window.__midiRequests = 0;
    Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: 'prompt' }) } });
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: async () => { __midiRequests++; throw new Error('Unexpected permission request'); } });
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(target, ...args) {
      if (target instanceof AudioDestinationNode && !window.__meter) {
        window.__audioContext = this.context;
        window.__meter = this.context.createAnalyser();
        connect.call(this, __meter);
      }
      return connect.call(this, target, ...args);
    };
    window.__peak = () => {
      if (!window.__meter) return 0;
      const data = new Float32Array(__meter.fftSize);
      __meter.getFloatTimeDomainData(data);
      return Math.max(...data.map(Math.abs));
    };
  });
}

async function appHelp(page) {
  if (!(await page.locator('#popupBackdrop').isVisible())) await page.locator('#helpBtn').click();
  await page.locator('#appDetails').evaluate(el => el.open = true);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = process.env.GLISSANDO_URL || `http://127.0.0.1:${server.address().port}/glissando/`;
  const browser = await chromium.launch({ headless: true, ...(process.env.GLISSANDO_BROWSER ? { executablePath: process.env.GLISSANDO_BROWSER } : {}) });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await prepare(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => navigator.serviceWorker.controller && document.getElementById('appStatus').textContent === 'Available offline');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    assert.equal(scope, url);
    const cdp = await context.newCDPSession(page);
    const manifest = await cdp.send('Page.getAppManifest');
    assert.deepEqual(manifest.errors, []);
    const installability = await cdp.send('Page.getInstallabilityErrors');
    // Playwright contexts are private profiles, where the browser disallows
    // installation. All app-specific installability requirements must still pass.
    assert.deepEqual(installability.installabilityErrors.filter(error => error.errorId !== 'in-incognito'), []);
    const parsed = JSON.parse(manifest.data);
    assert.equal(parsed.display, 'standalone');
    assert.equal(new URL(parsed.start_url, manifest.url).href, url);
    for (const icon of parsed.icons) {
      const response = await context.request.get(new URL(icon.src, manifest.url).href);
      assert.equal(response.status(), 200);
      assert.match(response.headers()['content-type'], /image\/png/);
    }
    console.log('PASS: project-scoped manifest, PNG icons and active offline worker');

    await page.evaluate(() => {
      window.__installPrompts = 0;
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = async () => { __installPrompts++; return { outcome: 'dismissed' }; };
      dispatchEvent(event);
    });
    await appHelp(page);
    await page.locator('#appInstall').click();
    assert.equal(await page.evaluate(() => __installPrompts), 1);
    assert.equal(await page.locator('#appInstall').isVisible(), false);
    await page.screenshot({ path: join(out, 'mobile-app-options.png') });
    await page.locator('#popupHelpPlayBtn').click();

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Edge can keep navigator.onLine true under network emulation; prove the
    // uncached network is blocked and the complete offline shell is still ready.
    assert.equal(await page.evaluate(async () => {
      try { await fetch('./offline-probe', { cache: 'no-store' }); return true; } catch (_) { return false; }
    }), false);
    await page.waitForFunction(() => /^(Available offline|Offline - ready to play)$/.test(document.getElementById('appStatus').textContent));
    await page.locator('#helpBtn').click();
    await page.locator('#popupHelpPlayBtn').click();
    await page.mouse.move(180, 330);
    await page.mouse.down();
    await page.waitForFunction(() => __audioContext.state === 'running' && __peak() > 0.01);
    await page.screenshot({ path: join(out, 'mobile-offline-playing.png') });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => __midiRequests), 0);
    await context.setOffline(false);
    console.log('PASS: offline reload, help-to-play measured audio and no MIDI permission prompt');

    if (!process.env.GLISSANDO_URL) {
      await page.evaluate(() => { window.__sessionToken = 'original'; State.setHold(true); });
      await page.mouse.move(180, 330);
      await page.mouse.down();
      await page.mouse.up();
      assert.equal(await page.evaluate(() => Controller.isPlaying), true);
      release = 'two';
      await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
      await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
      assert.equal(await page.evaluate(() => __sessionToken), 'original');
      assert.equal(await page.evaluate(() => Controller.isPlaying), true);
      await appHelp(page);
      await page.locator('#appUpdate').click();
      assert.match(await page.locator('#appUpdateStatus').textContent(), /Release all notes/);
      assert.equal(await page.evaluate(() => __sessionToken), 'original');
      await page.evaluate(() => { Controller.panic(); State.setHold(false); });

      const other = await context.newPage();
      await other.goto(url);
      await page.bringToFront();
      await page.locator('#appUpdate').click();
      await page.waitForFunction(() => document.getElementById('appUpdateStatus').textContent.includes('Close other'));
      assert.equal(await page.evaluate(() => __sessionToken), 'original');
      await page.screenshot({ path: join(out, 'update-other-window.png') });
      await other.close();
      await page.locator('#appUpdate').click();
      await page.waitForFunction(() => document.querySelector('meta[name="qa-release"]').content === 'two');
      assert.equal(await page.evaluate(() => window.__sessionToken), undefined);
      assert.equal(await page.evaluate(() => __midiRequests), 0);
      console.log('PASS: deployment does not interrupt held notes; explicit update guards notes and other windows, then reopens new release');

      // A failed precache must leave the last complete offline release usable.
      breakIcon = true;
      release = 'broken';
      await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        await reg.update();
        if (reg.installing) await new Promise(resolve => {
          const worker = reg.installing;
          worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(); });
        });
      });
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('meta[name="qa-release"]').getAttribute('content'), 'two');
      await context.setOffline(false);
      breakIcon = false;
      console.log('PASS: incomplete new release does not replace last working offline copy');
    }

    const unsupported = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    await prepare(unsupported);
    await unsupported.addInitScript(() => Object.defineProperty(navigator, 'requestMIDIAccess', { value: undefined }));
    const unsupportedPage = await unsupported.newPage();
    unsupportedPage.on('pageerror', error => errors.push(error.message));
    await unsupportedPage.goto(url);
    await unsupportedPage.locator('#helpBtn').click();
    assert.equal(await unsupportedPage.locator('#helpConnectBtn').isDisabled(), true);
    assert.match(await unsupportedPage.locator('#deviceSupport').textContent(), /cannot send MIDI/);
    await unsupportedPage.screenshot({ path: join(out, 'tablet-no-web-midi.png') });
    await unsupportedPage.locator('#popupHelpPlayBtn').click();
    await unsupportedPage.mouse.move(450, 330);
    await unsupportedPage.mouse.down();
    await unsupportedPage.waitForFunction(() => __peak() > 0.01);
    await unsupportedPage.mouse.up();
    await unsupported.close();
    await context.close();
    assert.deepEqual(errors, []);
    console.log(`PASS: unsupported-MIDI guidance preserves local playing; zero page errors. Screenshots: ${out}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
