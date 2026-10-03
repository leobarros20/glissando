const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const midiSource = html.slice(html.indexOf('const MidiOut ='), html.indexOf('function auroraColor'));
const routingSource = html.slice(html.indexOf('const OutputRouting ='), html.indexOf('const Popup ='));
const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

function harness({ permission = 'granted', ports = [], saved = {}, supported = true, queryFails = false, requestError = null } = {}) {
  const storage = new Map(Object.entries(saved));
  const timers = new Map();
  const statuses = [];
  const watch = { state: permission, onchange: null };
  const access = { outputs: new Map(), onstatechange: null };
  let timerId = 0;
  let requests = 0;
  let notesSent = 0;
  function port(id, name = id) {
    const p = {
      id, name, manufacturer: 'Test', state: 'connected', connection: 'closed',
      messages: [], opens: 0, closes: 0, clears: 0, failOpen: false, failSend: false, waitOpen: null,
      async open() {
        this.opens++;
        if (this.failOpen) throw new Error('Busy');
        if (this.waitOpen) await this.waitOpen;
        this.connection = 'open';
        access.onstatechange?.({ port: this });
        return this;
      },
      async close() {
        this.closes++;
        this.connection = 'closed';
        access.onstatechange?.({ port: this });
        return this;
      },
      clear() { this.clears++; },
      send(bytes, at) {
        if (this.failSend) throw new Error('Send failed');
        this.messages.push({ bytes: [...bytes], at });
      },
    };
    return p;
  }
  for (const [id, name] of ports) access.outputs.set(id, port(id, name));
  const navigator = {
    permissions: { async query() { if (queryFails) throw new TypeError('Unsupported'); return watch; } },
    ...(supported ? { async requestMIDIAccess(options) {
      requests++;
      assert.equal(options.sysex, false);
      if (requestError) throw requestError;
      return access;
    } } : {}),
  };
  const context = vm.createContext({
    navigator,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    performance: { now: () => 1000 },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    Analytics: { incMidi: () => notesSent++ },
  });
  vm.runInContext(midiSource + '\nglobalThis.midi = MidiOut;', context);
  context.midi.onStatus(s => statuses.push(s));
  return {
    midi: context.midi, context, access, watch, storage, statuses, timers, port,
    get requests() { return requests; },
    get notesSent() { return notesSent; },
    get last() { return statuses.at(-1); },
    async boot() { await context.midi.init(); await settle(); },
    async plug(p) { access.outputs.set(p.id, p); access.onstatechange?.({ port: p }); await settle(); },
    async unplug(p) { p.state = 'disconnected'; access.outputs.delete(p.id); access.onstatechange?.({ port: p }); await settle(); },
    async fireTimers(ms) {
      for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); }
      await settle();
    },
  };
}

test('fresh, denied, unsupported queries and unsupported MIDI never prompt on boot', async () => {
  for (const options of [{ permission: 'prompt' }, { permission: 'denied' }, { queryFails: true }, { supported: false }]) {
    const h = harness(options);
    await h.boot();
    assert.equal(h.requests, 0);
    assert.equal(h.midi.connected, false);
  }
});

test('explicit connect asks once and shares concurrent requests', async () => {
  const h = harness({ permission: 'prompt', ports: [['one', 'USB MIDI']] });
  const first = h.midi.requestAccess();
  const second = h.midi.requestAccess();
  assert.equal(first, second);
  await first;
  await settle();
  assert.equal(h.requests, 1);
  assert.equal(h.midi.selectedId, 'one');
  assert.equal(h.access.outputs.get('one').opens, 1);
});

test('saved output is restored once, ahead of other destinations', async () => {
  const h = harness({ ports: [['wrong', 'Glissando'], ['saved', 'IAC Bus']], saved: { 'glissando.midiDevice': 'saved' } });
  await h.boot();
  assert.equal(h.midi.selectedId, 'saved');
  assert.equal(h.access.outputs.get('saved').opens, 1);
  assert.equal(h.access.outputs.get('wrong').messages.length, 0);
  assert.equal(h.last.phase, 'ready');
  assert.ok(h.statuses.length < 10);
});

test('saved output can recover a changed ID from unique name and manufacturer', async () => {
  const h = harness({ ports: [['new', 'IAC Bus'], ['other', 'USB']], saved: {
    'glissando.midiDevice': 'old',
    'glissando.midiPort': JSON.stringify({ name: 'IAC Bus', manufacturer: 'Test' }),
  } });
  await h.boot();
  assert.equal(h.midi.selectedId, 'new');
});

test('unknown multiple outputs and the OS synth are not guessed or sent notes', async () => {
  for (const ports of [[['a', 'USB A'], ['b', 'USB B']], [['gs', 'Microsoft GS Wavetable Synth']]]) {
    const h = harness({ ports });
    await h.boot();
    assert.equal(h.midi.connected, false);
    assert.equal(h.last.phase, 'choose-output');
    for (const p of h.access.outputs.values()) assert.equal(p.messages.length, 0);
  }
});

test('an absent saved destination is not silently replaced with unrelated hardware', async () => {
  const h = harness({ ports: [['other', 'Hardware']], saved: { 'glissando.midiDevice': 'saved' } });
  await h.boot();
  assert.equal(h.midi.connected, false);
});

test('no devices stays local; hot-plug and replug restore the output', async () => {
  const h = harness();
  await h.boot();
  assert.equal(h.last.phase, 'no-output');
  assert.equal(h.midi.fingerDown(1, 60, 0.5), null);
  assert.equal(h.notesSent, 0);
  const p = h.port('usb');
  await h.plug(p);
  assert.equal(h.midi.connected, true);
  h.midi.fingerDown(1, 60, 0.5);
  await h.unplug(p);
  assert.equal(h.midi.connected, false);
  p.state = 'connected';
  await h.plug(p);
  assert.equal(h.midi.connected, true);
  assert.equal(h.midi.fingerDown(2, 60, 0.5), 1);
});

test('busy port preserves permission, avoids retry loops and allows explicit retry', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  const p = h.access.outputs.get('usb');
  p.failOpen = true;
  await h.boot();
  assert.equal(h.last.phase, 'port-error');
  assert.equal(h.last.permission, 'granted');
  assert.equal(p.opens, 1);
  p.failOpen = false;
  await h.midi.requestAccess();
  await settle();
  assert.equal(h.midi.connected, true);
});

test('a hung open times out, and a late resolution cannot select a stale output', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  const p = h.access.outputs.get('usb');
  let resolve;
  p.waitOpen = new Promise(r => { resolve = r; });
  await h.boot();
  assert.equal(h.last.phase, 'opening');
  await h.fireTimers(3000);
  assert.equal(h.last.phase, 'port-error');
  resolve();
  await settle();
  assert.equal(h.midi.connected, false);
  assert.equal(p.connection, 'closed');
});

test('the latest explicit selection wins if opens resolve out of order', async () => {
  const h = harness({ ports: [['a', 'A'], ['b', 'B']] });
  await h.boot();
  const a = h.access.outputs.get('a');
  let resolve;
  a.waitOpen = new Promise(r => { resolve = r; });
  const opening = h.midi.chooseOutput('a');
  await h.midi.chooseOutput('b');
  resolve();
  await opening;
  await settle();
  assert.equal(h.midi.selectedId, 'b');
  assert.equal(a.connection, 'closed');
});

test('switching outputs releases old notes before selecting the new port', async () => {
  const h = harness({ ports: [['a', 'A'], ['b', 'B']] });
  await h.boot();
  await h.midi.chooseOutput('a');
  h.midi.fingerDown(10, 60, 0.5);
  await h.midi.chooseOutput('b');
  const a = h.access.outputs.get('a');
  assert.ok(a.messages.some(m => m.bytes[0] === 0x81 && m.bytes[1] === 60));
  assert.equal(h.midi.fingerDown(11, 62, 0.5), 1);
});

test('MPE keeps each finger on its own channel and sends bend and CC74', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  await h.boot();
  assert.equal(h.midi.fingerDown(1, 60, 0.5), 1);
  assert.equal(h.midi.fingerDown(2, 64, 0.25), 2);
  h.midi.fingerMove(1, 72, 1);
  const messages = h.access.outputs.get('usb').messages.map(m => m.bytes);
  assert.ok(messages.some(m => m[0] === 0xE1 && m[1] === 0 && m[2] === 80));
  assert.ok(messages.some(m => m[0] === 0xB1 && m[1] === 74 && m[2] === 127));
  assert.ok(messages.some(m => m[0] === 0x92 && m[1] === 64));
  h.midi.panic();
  assert.equal(h.midi.fingerDown(3, 60, 0), 1);
});

test('test note schedules release, does not claim listening, and can be cancelled', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  await h.boot();
  assert.equal(h.midi.testNote(), true);
  assert.equal(h.midi.testNote(), false);
  assert.equal(h.last.testSent, true);
  assert.ok(h.access.outputs.get('usb').messages.some(m => m.bytes[0] === 0x81 && m.at === 1300));
  await h.fireTimers(350);
  assert.equal(h.last.testing, false);
  assert.equal(h.midi.testNote(), true);
  h.midi.panic();
  assert.equal(h.timers.size, 0);
});

test('send failure clears voices without falsely counting a transmitted note', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  await h.boot();
  h.access.outputs.get('usb').failSend = true;
  assert.equal(h.midi.fingerDown(1, 60, 0.5), null);
  assert.equal(h.notesSent, 0);
  assert.equal(h.last.phase, 'port-error');
  assert.equal(h.last.permission, 'granted');
});

test('playing cancels the test note and its queued release before allocating voices', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  await h.boot();
  const p = h.access.outputs.get('usb');
  h.midi.testNote();
  const clears = p.clears;
  h.midi.fingerDown(1, 60, 0.5);
  assert.equal(p.clears, clears + 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.last.testing, false);
  assert.ok(p.messages.some(m => m.bytes[0] === 0x81 && m.at === undefined));
});

test('permission revoked during an in-flight access request cannot reconnect late', async () => {
  const h = harness({ permission: 'prompt', ports: [['usb', 'USB']] });
  await h.boot();
  let resolve;
  h.context.navigator.requestMIDIAccess = () => new Promise(r => { resolve = r; });
  const pending = h.midi.requestAccess();
  h.watch.state = 'denied';
  h.watch.onchange();
  resolve(h.access);
  await pending;
  await settle();
  assert.equal(h.midi.connected, false);
  assert.equal(h.last.permission, 'denied');
});

test('a synchronous API error remains retryable', async () => {
  const h = harness({ permission: 'prompt' });
  h.context.navigator.requestMIDIAccess = () => { throw new Error('API error'); };
  await h.midi.requestAccess();
  assert.equal(h.last.phase, 'access-error');
  h.context.navigator.requestMIDIAccess = async () => h.access;
  await h.midi.requestAccess();
  assert.equal(h.last.phase, 'no-output');
});

test('permission revocation disconnects and clears active notes', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  await h.boot();
  h.midi.fingerDown(1, 60, 0.5);
  h.watch.state = 'denied';
  h.watch.onchange();
  await settle();
  assert.equal(h.midi.connected, false);
  assert.equal(h.last.permission, 'denied');
  assert.equal(h.last.outputs.length, 0);
});

test('permission denial is distinct from an unexpected access error', async () => {
  for (const [name, phase] of [['NotAllowedError', 'idle'], ['InvalidStateError', 'access-error']]) {
    const error = Object.assign(new Error('Access'), { name });
    const h = harness({ permission: 'prompt', requestError: error });
    await h.midi.requestAccess();
    assert.equal(h.last.phase, phase);
    assert.equal(h.midi.connected, false);
  }
});

test('routing waits for phrase end, falls back locally, and respects local preference', async () => {
  const h = harness({ ports: [['usb', 'USB']] });
  h.context.State = { mode: 'local', setMode(mode) { this.mode = mode; } };
  h.context.Controller = { isPlaying: true, panic() { this.isPlaying = false; } };
  vm.runInContext(routingSource + '\nglobalThis.routing = OutputRouting;', h.context);
  await h.boot();
  assert.equal(h.context.State.mode, 'local');
  h.context.Controller.isPlaying = false;
  h.context.routing.refresh();
  assert.equal(h.context.State.mode, 'midi');
  h.context.routing.choose('both');
  const p = h.access.outputs.get('usb');
  await h.unplug(p);
  assert.equal(h.context.State.mode, 'local');
  p.state = 'connected';
  await h.plug(p);
  assert.equal(h.context.State.mode, 'both');
  h.context.routing.choose('local');
  h.context.routing.refresh();
  assert.equal(h.context.State.mode, 'local');
  assert.equal(h.storage.get('glissando.outputMode'), 'local');
});
