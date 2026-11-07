const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('./static-server.cjs');

const out = process.env.GLISSANDO_QA_DIR || resolve(__dirname, '..', '..', '..', 'qa-landscape');
mkdirSync(out, { recursive: true });
const server = createServer();

async function prepare(context, options = {}) {
  await context.route(/google|clarity\.ms/, route => route.abort());
  await context.addInitScript(options => {
    localStorage.setItem('glissando.skin', 'chroma-dark');
    const qa = window.__screenQA = { calls: [], prompts: 0, midi: 0, audio: 0, fullscreen: false, outcome: 'dismissed' };
    Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: 'prompt' }) } });
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => { qa.midi++; throw Error('Unexpected MIDI prompt'); } });
    const Base = window.AudioContext;
    window.AudioContext = class extends Base { constructor(...args) { super(...args); qa.audio++; } };
    if (options.nativeScreen) return;
    const display = new EventTarget();
    const match = window.matchMedia.bind(window);
    window.matchMedia = query => query.startsWith('(display-mode:')
      ? { get matches() { return qa.fullscreen ? query === '(display-mode: fullscreen)' : query === '(display-mode: ' + options.launched + ')'; },
          addEventListener: (...args) => display.addEventListener(...args) }
      : match(query);
    Object.defineProperty(document, 'fullscreenElement', { get: () => qa.fullscreen ? document.documentElement : null });
    Object.defineProperty(document, 'fullscreenEnabled', { value: !options.unsupported });
    Element.prototype.requestFullscreen = options.unsupported ? undefined : async () => {
      qa.calls.push('fullscreen');
      if (options.rejected) throw new DOMException('Denied', 'NotAllowedError');
      qa.fullscreen = true;
      document.dispatchEvent(new Event('fullscreenchange'));
      display.dispatchEvent(new Event('change'));
    };
    document.exitFullscreen = async () => {
      qa.calls.push('exit');
      qa.fullscreen = false;
      document.dispatchEvent(new Event('fullscreenchange'));
      display.dispatchEvent(new Event('change'));
    };
    Object.defineProperty(screen.orientation, 'lock', { value: options.unsupported ? undefined : async direction => {
      qa.calls.push('lock:' + direction);
      if (options.rejected) throw new DOMException('Unsupported', 'NotSupportedError');
    } });
    Object.defineProperty(screen.orientation, 'unlock', { value: () => qa.calls.push('unlock') });
    qa.offerInstall = () => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = async () => {
        qa.prompts++;
        if (qa.outcome === 'error') throw Error('Blocked prompt');
        return { outcome: qa.outcome };
      };
      dispatchEvent(event);
    };
  }, options);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = process.env.GLISSANDO_URL || 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ headless: true, ...(process.env.GLISSANDO_BROWSER ? { executablePath: process.env.GLISSANDO_BROWSER } : {}) });
  const errors = [];
  const androidUA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: androidUA });
    await prepare(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    assert.deepEqual(errors, []);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#orientationGate').isVisible(), true);
    assert.equal(await page.locator('#stage').evaluate(el => el.inert), true);
    assert.equal(await page.evaluate(() => __screenQA.audio + __screenQA.midi + __screenQA.calls.length), 0);
    for (const [width, height] of [[390, 844], [320, 568], [768, 1024]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.locator('#orientationGate').isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ animations: 'disabled', path: join(out, 'portrait-' + width + '.png') });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#rotateDevice').click();
    assert.deepEqual(await page.evaluate(() => __screenQA.calls), ['fullscreen', 'lock:landscape']);
    assert.equal(await page.locator('#orientationGate').isVisible(), true, 'Wait for real orientation, not just a resolved lock');
    assert.equal(await page.locator('#installPwa').evaluate(el => el.hidden), false, 'API fullscreen is not an installed app');
    assert.equal(await page.evaluate(() => __screenQA.audio + __screenQA.midi), 0);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => document.getElementById('orientationGate').hidden);
    assert.equal(await page.locator('#stage').evaluate(el => el.inert), false);
    assert.ok((await page.locator('#appHeader').boundingBox()).height <= 57);
    await page.screenshot({ animations: 'disabled', path: join(out, 'landscape-instrument.png') });
    await page.locator('#fullscreenBtn').click();
    assert.deepEqual(await page.evaluate(() => __screenQA.calls.slice(-2)), ['exit', 'unlock']);
    assert.equal(await page.locator('#fullscreenBtn').getAttribute('aria-pressed'), 'false');

    // Dismissal, acceptance and prompt errors all keep an honest fallback.
    for (const outcome of ['dismissed', 'accepted', 'error']) {
      await page.evaluate(outcome => { __screenQA.outcome = outcome; __screenQA.offerInstall(); }, outcome);
      await page.locator('#installPwa').click();
      await page.waitForFunction(() => !document.querySelector('[data-view="install"]').classList.contains('hidden'));
      assert.equal(await page.locator('#installPromptBtn').isVisible(), false);
      const copy = await page.locator('#installStatus').textContent();
      assert.match(copy, outcome === 'accepted' ? /requested/ : outcome === 'error' ? /could not open/ : /cancelled/);
      assert.match(await page.locator('#installSteps').textContent(), /Chrome/);
      await page.screenshot({ animations: 'disabled', path: join(out, 'install-' + outcome + '.png') });
      await page.locator('#popupClose').click();
    }
    assert.equal(await page.evaluate(() => __screenQA.prompts), 3);
    await page.locator('#installPwa').click();
    assert.equal(await page.evaluate(() => __screenQA.prompts), 3, 'Never reuse a consumed install prompt');
    await page.locator('#popupClose').click();
    await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
    assert.equal(await page.locator('#installPwa').isVisible(), false);
    assert.match(await page.locator('#installStatus').textContent(), /^Installed/);
    await page.evaluate(() => State.setHold(true));
    await page.mouse.click(400, 210);
    assert.equal(await page.evaluate(() => Controller.isPlaying), true);
    await page.locator('#rootDd button').click();
    assert.equal(await page.locator('.dd-menu.open').count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !Controller.isPlaying);
    assert.equal(await page.locator('.dd-menu.open').count(), 0, 'Rotation closes portaled menus above the gate');
    await page.locator('#orientationHelp').click();
    await page.locator('#popupHelpPlayBtn').click();
    assert.equal(await page.locator('#orientationGate').isVisible(), true);
    assert.equal(await page.locator('#stage').evaluate(el => el.inert), true);
    assert.equal(await page.evaluate(() => __screenQA.midi), 0);
    await context.close();
    console.log('PASS: portrait gate, live rotation, fullscreen-before-lock, exit/unlock, install outcomes, focusable help and held-note release');

    for (const launched of ['standalone', 'fullscreen', 'minimal-ui']) {
      const app = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
      await prepare(app, { launched });
      const tab = await app.newPage();
      await tab.goto(url);
      assert.equal(await tab.locator('#installPwa').isVisible(), false, launched + ' must hide installation');
      assert.equal(await tab.locator('#orientationGate').isVisible(), false);
      if (await tab.locator('#fullscreenBtn').isVisible()) {
        await tab.locator('#fullscreenBtn').click();
        assert.equal(await tab.locator('#installPwa').evaluate(el => el.hidden), true, 'An installed app remains installed while using the Fullscreen API');
        await tab.locator('#fullscreenBtn').click();
      }
      await app.close();
    }
    const fallback = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
    await prepare(fallback, { unsupported: true });
    const ios = await fallback.newPage();
    ios.on('pageerror', error => errors.push(error.message));
    await ios.goto(url);
    assert.equal(await ios.locator('#rotateDevice').isVisible(), false);
    assert.match(await ios.locator('#orientationHint').textContent(), /Control Center/);
    await ios.locator('#orientationInstall').click();
    assert.match(await ios.locator('#installSteps').textContent(), /Safari.*Share.*Add to Home Screen/);
    await ios.screenshot({ animations: 'disabled', path: join(out, 'ios-install-instructions.png') });
    await ios.locator('#popupClose').click();
    assert.equal(await ios.locator('#orientationGate').evaluate(el => el.inert), false);
    assert.equal(await ios.evaluate(() => __screenQA.audio + __screenQA.midi), 0);
    await ios.setViewportSize({ width: 844, height: 390 });
    assert.equal(await ios.locator('#fullscreenBtn').isVisible(), false);
    await fallback.close();

    const rejected = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    await prepare(rejected, { rejected: true });
    const tab = await rejected.newPage();
    await tab.goto(url);
    await tab.locator('#fullscreenBtn').click();
    assert.match(await tab.locator('#screenStatus').textContent(), /unavailable/);
    assert.equal(await tab.locator('#stage').evaluate(el => el.inert), false);
    await rejected.close();

    const native = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await prepare(native, { nativeScreen: true });
    const real = await native.newPage();
    real.on('pageerror', error => errors.push(error.message));
    await real.goto(url);
    await real.locator('#fullscreenBtn').click();
    await real.waitForFunction(() => !!document.fullscreenElement);
    assert.equal(await real.locator('#installPwa').evaluate(el => el.hidden), false);
    await real.locator('#fullscreenBtn').click();
    await real.waitForFunction(() => !document.fullscreenElement);
    await native.close();
    assert.deepEqual(errors, []);
    console.log('PASS: installed display modes, real browser fullscreen, unavailable/denied APIs, iOS manual steps and zero page errors');
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.closeAllConnections(); server.close(); process.exitCode = 1; });
