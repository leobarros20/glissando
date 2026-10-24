const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { createServer } = require('./static-server.cjs');
const { chromium } = require('playwright');

const root = resolve(__dirname, '..');
const out = process.env.GLISSANDO_QA_DIR || resolve(root, '..', '..', 'qa-web-only');
mkdirSync(out, { recursive: true });
const server = createServer({ root });
const skin = process.env.GLISSANDO_SKIN || 'original';

async function prepare(context, permission = 'prompt', ports = []) {
  await context.route(/google|clarity\.ms/, route => route.abort());
  await context.addInitScript(({ permission, ports, skin }) => {
    if (!localStorage.getItem('glissando.skin')) localStorage.setItem('glissando.skin', skin);
    const watch = { state: permission, onchange: null };
    const access = { outputs: new Map(), onstatechange: null };
    const messages = [];
    const test = window.__midi = { requests: 0, messages, access, watch };
    test.plug = (id, name = id) => {
      const port = {
        id, name, manufacturer: 'Browser test', state: 'connected', connection: 'closed',
        async open() { this.connection = 'open'; access.onstatechange?.({ port: this }); return this; },
        async close() { this.connection = 'closed'; access.onstatechange?.({ port: this }); return this; },
        clear() {},
        send(bytes, at) { messages.push({ id, bytes: [...bytes], at }); },
      };
      access.outputs.set(id, port);
      access.onstatechange?.({ port });
    };
    test.unplug = id => {
      const port = access.outputs.get(id);
      port.state = 'disconnected';
      access.outputs.delete(id);
      access.onstatechange?.({ port });
    };
    for (const [id, name] of ports) test.plug(id, name);
    Object.defineProperty(navigator, 'permissions', { value: { query: async () => watch }, configurable: true });
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => {
      test.requests++;
      watch.state = 'granted';
      return access;
    }, configurable: true });

    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(...args) {
        super(...args);
        window.__audio = this;
        window.__meter = this.createAnalyser();
      }
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(target, ...args) {
      if (target === window.__audio?.destination) connect.call(this, window.__meter);
      return connect.call(this, target, ...args);
    };
    window.__peak = () => {
      if (!window.__meter) return 0;
      const values = new Float32Array(window.__meter.fftSize);
      window.__meter.getFloatTimeDomainData(values);
      return Math.max(...values.map(Math.abs));
    };
  }, { permission, ports, skin });
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = process.env.GLISSANDO_URL || `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, ...(process.env.GLISSANDO_BROWSER ? { executablePath: process.env.GLISSANDO_BROWSER } : {}) });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await prepare(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    assert.equal(await page.locator('#popupBackdrop').isVisible(), false);
    assert.equal(await page.evaluate(() => __midi.requests), 0);
    assert.equal(await page.locator('#skinSelect').inputValue(), skin);
    const gridBefore = await page.locator('.note-label').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().x + n.getBoundingClientRect().width / 2));
    await page.screenshot({ animations: 'disabled', path: join(out, 'desktop-instrument.png') });
    await page.mouse.move(560, 300);
    await page.mouse.down();
    await page.waitForFunction(() => __audio.state === 'running' && __peak() > 0.01);
    await page.evaluate(() => { window.__originalAudio = __audio; });
    const other = skin === 'chroma-dark' ? 'chroma' : 'chroma-dark';
    await page.locator('#skinSelect').selectOption(other);
    assert.equal(await page.evaluate(() => __audio === __originalAudio && Controller.isPlaying), true);
    await page.waitForFunction(() => __peak() > 0.01);
    const gridAfter = await page.locator('.note-label').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().x + n.getBoundingClientRect().width / 2));
    assert.deepEqual(gridAfter, gridBefore);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => __midi.requests), 0);
    await page.reload();
    assert.equal(await page.locator('#skinSelect').inputValue(), other);
    assert.equal(await page.locator('html').getAttribute('data-skin'), other);
    await page.locator('#skinSelect').selectOption(skin);
    await page.locator('#skinSelect').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#skinSelect').inputValue(), 'chroma');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#skinSelect').inputValue(), 'chroma-dark');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#skinSelect').inputValue(), 'original');
    await page.locator('#skinSelect').selectOption(skin);
    if (skin !== 'original') {
      const geometry = async () => page.locator('#bar, #botBar, #skinSelect, .note-label, .pitch-band').evaluateAll(nodes => nodes.map(el => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      }));
      const before = await geometry();
      await page.locator('#skinSelect').selectOption(skin === 'chroma' ? 'chroma-dark' : 'chroma');
      assert.deepEqual(await geometry(), before, 'Light and dark must use identical geometry');
      await page.locator('#skinSelect').selectOption(skin);
      await page.waitForFunction(expected => getComputedStyle(document.querySelector('#spanToggle .span-side.right')).color === expected,
        skin === 'chroma' ? 'rgb(255, 255, 255)' : 'rgb(24, 25, 27)');
      const pairs = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const token = name => style.getPropertyValue(name).trim();
        const selected = getComputedStyle(document.querySelector('#snapSeg .on'));
        const inverse = getComputedStyle(document.querySelector('#spanToggle .span-side.right'));
        return {
          body: [token('--color-text'), token('--color-surface')],
          muted: [token('--color-muted'), token('--color-surface')],
          tonic: [token('--color-tonic'), token('--color-lane-alt')],
          link: [token('--color-link'), token('--color-surface')],
          selected: [selected.color, selected.backgroundColor],
          inverse: [inverse.color, token('--color-inverse')],
        };
      });
      function luminance(color) {
        const channels = color.startsWith('#') ? color.slice(1).match(/../g).map(s => parseInt(s, 16)) : color.match(/[\d.]+/g).slice(0, 3).map(Number);
        const [r, g, b] = channels.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
        return .2126 * r + .7152 * g + .0722 * b;
      }
      for (const [name, [foreground, background]] of Object.entries(pairs)) {
        const a = luminance(foreground), b = luminance(background);
        assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${name} text contrast must be at least 4.5:1 (${foreground} on ${background})`);
      }
      assert.equal(await page.evaluate(() => Appearance.paint.ink), skin === 'chroma' ? '#171717' : '#f1f2f4');
      assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), skin === 'chroma' ? '#f0f1f2' : '#18191b');
      console.log('PASS: shared light/dark geometry, semantic text contrast and CSS-driven canvas/browser colors');
    }
    console.log('PASS: skin selection persists and leaves active audio, pitch positions and MIDI permission unchanged');
    await page.locator('#rootDd button').click();
    await page.screenshot({ animations: 'disabled', path: join(out, 'desktop-root-menu.png') });
    await page.locator('#rootDd button').click();

    for (const exit of ['play', 'close', 'escape', 'backdrop']) {
      await page.reload();
      await page.locator('#helpBtn').click();
      assert.equal(await page.locator('#popupBackdrop').getAttribute('aria-hidden'), 'false');
      if (exit === 'play') await page.locator('#popupHelpPlayBtn').click();
      if (exit === 'close') await page.locator('#popupClose').click();
      if (exit === 'escape') await page.keyboard.press('Escape');
      if (exit === 'backdrop') await page.mouse.click(10, 350);
      await page.mouse.move(550, 300);
      await page.mouse.down();
      await page.waitForFunction(() => __audio.state === 'running' && __peak() > 0.01);
      await page.mouse.up();
      assert.equal(await page.evaluate(() => __midi.requests), 0);
    }
    console.log('PASS: first-touch audio and all four help exits produce a measured audio signal without MIDI permission');

    await page.evaluate(() => __audio.suspend());
    await page.mouse.move(600, 330);
    await page.mouse.down();
    await page.waitForFunction(() => __audio.state === 'running' && __peak() > 0.01);
    await page.mouse.up();
    await page.locator('#modeBtn').click();
    await page.locator('#midiRetry').click();
    await page.waitForFunction(() => document.getElementById('midiStatus').textContent.includes('no MIDI output'));
    assert.equal(await page.evaluate(() => __midi.requests), 1);
    assert.match(await page.locator('#modeBtn').textContent(), /synth/);
    await page.evaluate(() => __midi.plug('usb', 'Glissando USB'));
    await page.waitForFunction(() => document.getElementById('modeBtn').textContent === 'output: midi');
    await page.locator('#midiTest').click();
    await page.waitForFunction(() => __midi.messages.some(m => (m.bytes[0] & 240) === 128 && m.at > 0));
    await page.screenshot({ animations: 'disabled', path: join(out, 'desktop-midi-ready.png') });
    await page.evaluate(() => __midi.unplug('usb'));
    await page.waitForFunction(() => document.getElementById('modeBtn').textContent === 'output: synth');
    await page.evaluate(() => __midi.plug('usb', 'Glissando USB'));
    await page.waitForFunction(() => document.getElementById('modeBtn').textContent === 'output: midi');
    console.log('PASS: explicit permission, hot-plug, scheduled test note-off, disconnect fallback and reconnect');

    await page.locator('#helpBtn').click();
    await page.getByText('Your DAW', { exact: true }).click();
    assert.equal(await page.locator('#dawGuideSelect option').count(), 10);
    await page.locator('#dawGuideSelect').selectOption('REAPER');
    assert.match(await page.locator('#dawGuideText').innerText(), /all channels/);
    await page.screenshot({ animations: 'disabled', path: join(out, 'desktop-help.png') });
    await page.locator('#popupClose').click();

    for (const [name, width, height] of [['desktop', 1280, 720], ['mobile', 390, 844], ['small-mobile', 320, 568], ['mobile-landscape', 844, 390], ['tablet', 1024, 768], ['wide-desktop', 1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => { document.getElementById('bar').scrollLeft = 0; document.getElementById('botBar').scrollLeft = 0; });
      await page.screenshot({ animations: 'disabled', path: join(out, `${name}-instrument.png`) });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const id of ['modeBtn', 'helpBtn', 'skinSelect']) {
        const control = await page.locator('#' + id).boundingBox();
        assert.ok(control.x >= 0 && control.x + control.width <= width + 1, `${id} must be visible without scrolling`);
      }
      await page.locator('#modeBtn').click();
      const panel = await page.locator('#midiPanel').boundingBox();
      assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= width + 1);
      await page.screenshot({ animations: 'disabled', path: join(out, `${name}-midi.png`) });
      await page.locator('#modeBtn').click();
      await page.locator('#helpBtn').click();
      const bounds = await page.locator('#popup').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1);
      await page.screenshot({ animations: 'disabled', path: join(out, `${name}-help.png`) });
      await page.locator('#popupClose').click();
    }
    await context.close();

    const mpe = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
    await prepare(mpe, 'granted', [['usb', 'Glissando USB']]);
    const midiPage = await mpe.newPage();
    midiPage.on('pageerror', error => errors.push(error.message));
    await midiPage.goto(url);
    await midiPage.waitForFunction(() => document.getElementById('modeBtn').textContent === 'output: midi');
    const cdp = await mpe.newCDPSession(midiPage);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 450, y: 320, id: 1 }, { x: 458, y: 324, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 520, y: 290, id: 1 }, { x: 525, y: 300, id: 2 }] });
    const beforeSkin = await midiPage.evaluate(() => __midi.messages.filter(m => [0x80, 0x90].includes(m.bytes[0] & 0xf0)).length);
    for (const value of ['original', 'chroma', 'chroma-dark']) await midiPage.locator('#skinSelect').selectOption(value);
    await midiPage.locator('#skinSelect').selectOption(skin);
    assert.equal(await midiPage.evaluate(() => __midi.messages.filter(m => [0x80, 0x90].includes(m.bytes[0] & 0xf0)).length), beforeSkin);
    await midiPage.screenshot({ animations: 'disabled', path: join(out, 'mpe-close-fingers.png') });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const messages = await midiPage.evaluate(() => __midi.messages.map(m => m.bytes));
    assert.ok(messages.some(m => m[0] === 0x91));
    assert.ok(messages.some(m => m[0] === 0x92));
    assert.ok(messages.some(m => m[0] === 0x81));
    assert.ok(messages.some(m => m[0] === 0x82));
    await midiPage.reload();
    await midiPage.waitForFunction(() => document.getElementById('modeBtn').textContent === 'output: midi');
    if (skin !== 'original') {
      await midiPage.setViewportSize({ width: 1448, height: 1086 });
      const ends = [{ x: 253, y: 610, id: 1 }, { x: 725, y: 460, id: 2 }, { x: 1140, y: 520, id: 3 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: ends.map(p => ({ ...p, x: p.x + 80, y: p.y - 100 })) });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: ends.map(p => ({ ...p, x: p.x + 80 * (1 - i / 8), y: p.y - 100 * (1 - i / 8) ** 2 })) });
      }
      await midiPage.screenshot({ animations: 'disabled', path: join(out, 'chroma-reference-playing.png') });
      assert.ok(await midiPage.evaluate(() => {
        const canvas = document.getElementById('touchLayer');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++;
        return painted > 500;
      }));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    console.log('PASS: granted-permission boot, saved-port reload and close-finger MPE channels/release');
    await mpe.close();
    assert.deepEqual(errors, []);
    console.log(`PASS: responsive bounds, ten DAW guides and zero page errors. Screenshots: ${out}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
