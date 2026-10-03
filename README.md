# Glissando

Glissando is an expressive multi-touch browser instrument. Move left to right for pitch, move up and down for expression, and use the toolbar to choose a scale, snap behavior, octave span, and output destination.

Live app:

https://leobarros20.github.io/glissando/

## Outputs

- Browser synth: plays the built-in Web Audio synth in the page.
- MIDI controller: sends MPE-style MIDI through the browser Web MIDI API.
- Both: plays the browser synth and sends MIDI at the same time.

Glissando is web-only. It requires no Glissando app, plug-in, bridge or driver installation. The playing surface opens immediately and the first touch starts local audio, including after closing help.

## Connecting Without Installing Anything

- Use a browser with Web MIDI support. Open the output panel and choose **connect MIDI** once to grant access. Playing locally never requests MIDI permission.
- With permission already granted, the page discovers ports in the background. It restores the saved output, a uniquely named Glissando output, or a single eligible destination. Multiple unknown outputs require a choice; it does not send test notes blindly to every device.
- Ports are explicitly opened with a three-second timeout. Hot-plugging restores a known output; disconnection returns to local sound between phrases. A deliberate local/both preference is remembered.
- **MIDI ready** means the output opened, not that the DAW is listening. **test note** sends a short note to the selected output with a scheduled note-off. Glissando cannot automatically confirm DAW audio or recording.
- On macOS, the built-in IAC Driver can route MIDI between apps. On supported Android devices, USB MIDI peripheral mode can route to a computer. Windows needs a MIDI route already exposed by the system or compatible hardware. USB presence alone is not enough.
- If the system exposes no suitable output, a web page cannot create a virtual MIDI port. Local playing remains available. No-install support does not mean every browser/computer/DAW combination can connect.

MPE output uses lower-zone note channels 2-6, pitch bend +/-48 semitones and CC74 for vertical expression. Free/Pull/Lock change pitch behavior, not the output protocol. Match the receiving instrument's settings.

Help contains short guides and official documentation links for ten DAWs: Ableton Live, Logic Pro, Cubase, Bitwig Studio, REAPER, Studio One, FL Studio, Pro Tools, Reason and GarageBand. This is a coverage list, not a popularity ranking or a claim of tested full MPE compatibility. End-to-end physical-device recording still requires validation per DAW/version/instrument.

API and routing references: [Web MIDI](https://www.w3.org/TR/webmidi/), [browser permissions](https://developer.chrome.com/blog/web-midi-permission-prompt), [Apple IAC](https://support.apple.com/en-ie/guide/audio-midi-setup/ams1013/mac), [Android MIDI](https://developer.android.com/reference/android/media/midi/package-summary).

## Local Development

This repo is intentionally small: the app lives in `index.html`.

Run the regression checks:

```sh
npm test
```

`test/midi-behavior.test.js` executes the actual inline MIDI module against simulated ports and permissions. For browser checks, run `node scripts/browser-check.cjs` with Playwright available. Optionally set `GLISSANDO_BROWSER` to an installed Chromium/Edge executable, `GLISSANDO_QA_DIR` for screenshots, or `GLISSANDO_URL` to check a deployed build. The browser check measures real Web Audio output but simulates MIDI hardware; it does not certify DAW reception.

Serve locally:

```sh
npx serve .
```

Then open the printed local URL in a browser.

## Notes

The older `build/files` folder in the parent workspace contains a previous WebSocket bridge build. The current GitHub Pages version does not use that bridge; it talks to MIDI devices directly through Web MIDI.
