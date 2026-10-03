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

test('connection help is web-only and keeps platform details optional', () => {
  assert.match(html, /connect to a DAW/);
  assert.match(html, /Just want to play\?/);
  assert.match(html, /Play an instrument in your DAW/);
  assert.match(html, /<ol>[\s\S]*Connect MIDI[\s\S]*arm the track[\s\S]*test note[\s\S]*<\/ol>/);
  assert.match(html, /<summary>No output\? Mac<\/summary>/);
  assert.match(html, /<summary>No output\? Windows<\/summary>/);
  assert.match(html, /<summary>Android tablet \+ laptop<\/summary>/);
  assert.doesNotMatch(html, /<h3>Controls<\/h3>/);
  assert.doesNotMatch(html, /loopMIDI|Install and open|new WebSocket/);
  assert.match(html, /id="dawGuideSelect"/);
  assert.match(html, /not a verified compatibility list/);
});

test('play works directly from the connection help view', () => {
  assert.match(html, /id="popupHelpPlayBtn">play now<\/button>/);
  assert.match(html, /function startGlissando\(\)/);
  assert.match(html, /\['popupStartBtn', 'popupHelpPlayBtn'\]\.forEach/);
  assert.match(html, /if \(appStarted\) \{[\s\S]*Audio\.resume\(\);[\s\S]*return;/);
  assert.match(html, /closeBtn\.addEventListener\('click', startGlissando\)/);
  assert.match(html, /function onDown\(e\)[\s\S]*startGlissando\(\)/);
  assert.match(html, /id="popupBackdrop" class="popup-backdrop" inert aria-hidden="true"/);
});

test('audio starts in the gesture and does not request MIDI permission', () => {
  const startFunction = html.slice(
    html.indexOf('function startGlissando()'),
    html.indexOf("['popupStartBtn', 'popupHelpPlayBtn']")
  );
  const controllerStart = startFunction.indexOf('Controller.start();');
  const orientationLock = startFunction.indexOf("screen.orientation.lock('landscape')");
  const wakeLock = startFunction.indexOf("navigator.wakeLock.request('screen')");

  assert.ok(controllerStart !== -1 && controllerStart < orientationLock);
  assert.ok(controllerStart < wakeLock);
  assert.doesNotMatch(startFunction, /MidiOut\.(init|requestAccess)/);
  assert.doesNotMatch(startFunction, /await/);
  assert.match(html, /resume\(\) \{[\s\S]*actx\.state === 'suspended'[\s\S]*actx\.resume\(\)/);
});
