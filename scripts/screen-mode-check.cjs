const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('./static-server.cjs');

const out = process.env.GLISSANDO_QA_DIR || resolve(__dirname, '..', '..', '..', 'qa-landscape');
mkdirSync(out, { recursive: true });
const server = createServer();
let browser;
const watchdog = setTimeout(async () => {
  console.error('Screen checks exceeded 90 seconds');
  await browser?.close();
  server.closeAllConnections();
  server.close();
  process.exitCode = 1;
}, 90000);

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
        if (qa.deferPrompt) await new Promise(resolve => { qa.resolvePrompt = resolve; });
        if (qa.outcome === 'error') throw Error('Blocked prompt');
        if (qa.earlyInstall) dispatchEvent(new Event('appinstalled'));
        return { outcome: qa.outcome };
      };
      dispatchEvent(event);
    };
  }, options);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = process.env.GLISSANDO_URL || 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({ headless: true, ...(process.env.GLISSANDO_BROWSER ? { executablePath: process.env.GLISSANDO_BROWSER } : {}) });
  const errors = [];
  const androidUA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: androidUA });
    await prepare(context);
    const page = await context.newPage();
    await page.clock.install();
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

    // A pending native prompt shows activity without resizing or allowing duplicates.
    const installBounds = await page.locator('#installPwa').boundingBox();
    await page.evaluate(() => { __screenQA.deferPrompt = true; __screenQA.offerInstall(); });
    await page.locator('#installPwa').click();
    assert.equal(await page.locator('#installPwa').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('#installPwa .install-spinner').isVisible(), true);
    assert.equal(await page.locator('#installPwa .install-idle').isVisible(), false);
    assert.deepEqual(await page.locator('#installPwa').boundingBox(), installBounds);
    await page.evaluate(() => document.getElementById('installPwa').click());
    assert.equal(await page.evaluate(() => __screenQA.prompts), 1);
    await page.screenshot({ animations: 'disabled', path: join(out, 'install-prompt-loading.png') });
    await page.evaluate(() => { __screenQA.deferPrompt = false; __screenQA.resolvePrompt(); });
    await page.waitForFunction(() => document.getElementById('installStatus').dataset.state === 'cancelled');
    await page.locator('#popupClose').click();

    // Dismissal, prompt errors and a missing confirmation all stop activity honestly.
    for (const outcome of ['dismissed', 'error', 'accepted']) {
      await page.evaluate(outcome => { __screenQA.outcome = outcome; __screenQA.offerInstall(); }, outcome);
      await page.locator('#installPwa').click();
      await page.waitForFunction(() => !document.querySelector('[data-view="install"]').classList.contains('hidden'));
      assert.equal(await page.locator('#installPromptBtn').isVisible(), false);
      const copy = await page.locator('#installStatus').textContent();
      assert.match(copy, outcome === 'accepted' ? /requested/ : outcome === 'error' ? /could not open/ : /cancelled/);
      assert.equal(await page.locator('#installPwa').getAttribute('aria-busy'), String(outcome === 'accepted'));
      assert.equal(await page.locator('#installStatus .install-spinner').isVisible(), outcome === 'accepted');
      assert.match(await page.locator('#installSteps').textContent(), /Chrome/);
      await page.screenshot({ animations: 'disabled', path: join(out, 'install-' + outcome + '.png') });
      if (outcome === 'accepted') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('#installStatus .install-spinner').evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        for (const skin of ['chroma', 'chroma-dark']) {
          await page.evaluate(skin => Appearance.apply(skin, false), skin);
          await page.setViewportSize({ width: 390, height: 844 });
          await page.screenshot({ animations: 'disabled', path: join(out, 'install-loading-' + skin + '.png') });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await page.setViewportSize({ width: 844, height: 390 });
        await page.clock.fastForward(31000);
        assert.equal(await page.locator('#installPwa').getAttribute('aria-busy'), 'false');
        assert.equal(await page.locator('#installStatus .install-spinner').isVisible(), false);
        assert.equal(await page.locator('#installStatus').getAttribute('data-state'), 'unconfirmed');
        assert.match(await page.locator('#installStatus').textContent(), /not confirmed/);
        assert.equal(await page.locator('#installSteps').isVisible(), true);
        assert.equal(await page.locator('#installNotice').textContent(), '');
      }
      await page.locator('#popupClose').click();
    }
    assert.equal(await page.evaluate(() => __screenQA.prompts), 4);
    await page.locator('#installPwa').click();
    assert.equal(await page.evaluate(() => __screenQA.prompts), 4, 'Never reuse a consumed install prompt');
    assert.match(await page.locator('#installStatus').textContent(), /not confirmed/);
    await page.locator('#popupClose').click();
    await page.evaluate(() => { __screenQA.offerInstall(); });
    await page.locator('#installPwa').click();
    assert.equal(await page.locator('#installPwa').getAttribute('aria-busy'), 'true');
    await page.locator('#popupClose').click();
    const focusBeforeNotice = await page.evaluate(() => document.activeElement.id);
    await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
    assert.equal(await page.locator('#installPwa').isVisible(), false);
    assert.match(await page.locator('#installStatus').textContent(), /Glissando added/);
    assert.match(await page.locator('#installNotice').textContent(), /icon may take a moment/);
    assert.equal(await page.locator('#installPwa').getAttribute('aria-busy'), 'false');
    assert.equal(await page.locator('#popupBackdrop').isVisible(), false, 'Confirmation never interrupts playing with a dialog');
    assert.equal(await page.evaluate(() => document.activeElement.id), focusBeforeNotice);
    assert.equal(await page.locator('#installNotice').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await page.screenshot({ animations: 'disabled', path: join(out, 'install-confirmed.png') });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.fastForward(31000);
    assert.match(await page.locator('#installNotice').textContent(), /Glissando added/, 'Keep confirmation until the user returns from the OS installation');
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.fastForward(11000);
    assert.equal(await page.locator('#installNotice').textContent(), '');
    assert.equal(await page.locator('#installStatus').getAttribute('data-state'), 'confirmed', 'Confirmation cancels the pending timeout');
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
    console.log('PASS: stable loading icons, reduced motion, bounded confirmation wait, early/late confirmation and nonblocking notice lifetime');

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
    assert.equal(await ios.locator('#orientationInstall').getAttribute('aria-busy'), 'false');
    assert.equal(await ios.locator('#installStatus .install-spinner').isVisible(), false);
    await ios.screenshot({ animations: 'disabled', path: join(out, 'ios-install-instructions.png') });
    await ios.locator('#popupClose').click();
    assert.equal(await ios.locator('#orientationGate').evaluate(el => el.inert), false);
    assert.equal(await ios.evaluate(() => __screenQA.audio + __screenQA.midi), 0);
    await ios.setViewportSize({ width: 844, height: 390 });
    assert.equal(await ios.locator('#fullscreenBtn').isVisible(), false);
    await fallback.close();

    // Some browsers signal appinstalled before prompt() resolves.
    const early = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await prepare(early);
    const fast = await early.newPage();
    fast.on('pageerror', error => errors.push(error.message));
    await fast.goto(url);
    await fast.evaluate(() => { __screenQA.outcome = 'accepted'; __screenQA.earlyInstall = true; __screenQA.offerInstall(); });
    await fast.locator('#installPwa').click();
    assert.equal(await fast.locator('#installStatus').getAttribute('data-state'), 'confirmed');
    assert.match(await fast.locator('#installNotice').textContent(), /Glissando installed/);
    assert.equal(await fast.locator('#installPwa').getAttribute('aria-busy'), 'false');
    assert.equal(await fast.locator('#popupBackdrop').isVisible(), false);
    await early.close();

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
    clearTimeout(watchdog);
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { clearTimeout(watchdog); console.error(error); server.closeAllConnections(); server.close(); process.exitCode = 1; });
