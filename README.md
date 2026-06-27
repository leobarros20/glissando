# Glissando

Glissando is an expressive multi-touch browser instrument. Move left to right for pitch, move up and down for expression, and use the toolbar to choose a scale, snap behavior, octave span, and output destination.

Live app:

https://leobarros20.github.io/glissando/

## Outputs

- Browser synth: plays the built-in Web Audio synth in the page.
- MIDI controller: sends MPE-style MIDI through the browser Web MIDI API.
- Both: plays the browser synth and sends MIDI at the same time.

MIDI output works best in Chrome or another browser with Web MIDI support. On macOS, create an IAC bus in Audio MIDI Setup. On Windows, create a virtual port with loopMIDI. On Android tablets, USB MIDI can expose the tablet as a MIDI device to a laptop.

## Local Development

This repo is intentionally small: the app lives in `index.html`.

Run the regression checks:

```sh
npm test
```

Serve locally:

```sh
npx serve .
```

Then open the printed local URL in a browser.

## Notes

The older `build/files` folder in the parent workspace contains a previous WebSocket bridge build. The current GitHub Pages version does not use that bridge; it talks to MIDI devices directly through Web MIDI.
