const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const editorHtml = readFileSync(join(__dirname, '..', 'glissando-text-editor.html'), 'utf8');

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

test('text editor can load, edit, and export index.html as a single file', () => {
  assert.match(editorHtml, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.match(editorHtml, /id="sourceFile"/);
  assert.match(editorHtml, /async function loadSiblingIndex/);
  assert.match(editorHtml, /function collectEditableStrings/);
  assert.match(editorHtml, /function applyEdits/);
  assert.match(editorHtml, /const MAX_RENDERED = 120/);
  assert.match(editorHtml, /id="showAllMatches"/);
  assert.match(editorHtml, /showSaveFilePicker/);
  assert.match(editorHtml, /download="index.html"/);
});

test('near-line visual ownership is stable when close fingers compete', () => {
  assert.match(html, /nearLineOwners/);
  assert.match(html, /NEAR_OWNER_SWITCH_SEMITONES/);
  assert.match(html, /ownedCandidate/);
  assert.match(html, /best\.pitchDist \+ NEAR_OWNER_SWITCH_SEMITONES/);
  assert.match(html, /releaseNearLineOwnersForFinger/);
});

test('connection help keeps the main path short and hides platform details', () => {
  assert.match(html, /connect to a DAW/);
  assert.match(html, /Just want to play\?/);
  assert.match(html, /Play an instrument in your DAW/);
  assert.match(html, /<ol>[\s\S]*Create one MIDI port[\s\S]*output: synth[\s\S]*arm the track[\s\S]*<\/ol>/);
  assert.match(html, /<details>[\s\S]*<summary>Mac<\/summary>/);
  assert.match(html, /<summary>Windows<\/summary>/);
  assert.match(html, /<summary>Android tablet \+ laptop<\/summary>/);
  assert.doesNotMatch(html, /<h3>Controls<\/h3>/);
});
