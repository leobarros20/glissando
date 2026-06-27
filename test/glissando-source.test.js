const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

test('output destination exposes synth, MIDI, and both modes', () => {
  assert.match(html, /value:\s*'local',\s*label:\s*'browser synth'/);
  assert.match(html, /value:\s*'midi',\s*label:\s*'midi controller'/);
  assert.match(html, /value:\s*'both',\s*label:\s*'both \(synth \+ midi\)'/);
  assert.doesNotMatch(html, /State\.mode === 'both'\s*\?\s*'local'/);
  assert.match(html, /both:\s*'output: both'/);
  assert.match(html, /\(mode === 'midi' \|\| mode === 'both'\) && !MidiOut\.connected/);
});

test('hold control is visible and releases held voices when turned off', () => {
  assert.match(html, /id="holdToggle"/);
  assert.match(html, /State\.setHold\(!State\.hold\)/);
  assert.match(html, /if \(!State\.hold\) Controller\.releaseHeld\(\)/);
  assert.match(html, /holdToggle\.classList\.toggle\('on', State\.hold\)/);
});

test('page declares an inline favicon to avoid a missing favicon request', () => {
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
});
