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
- **Phone/tablet to computer:** use Chrome on an Android device supporting USB MIDI peripheral mode. Connect a USB data cable, choose MIDI in Android's USB options, grant MIDI permission in Glissando, then select the phone's input on an armed DAW instrument track. If Windows or macOS recognizes the phone as USB MIDI, this route needs no virtual MIDI bridge. Device/browser support must be checked; a cable alone is not enough.
- **iPhone/iPad Safari:** Web MIDI is unavailable, including from the home screen. Local sound still works; this web-only USB-to-DAW route does not.
- **Browser and DAW on the same computer:** macOS's built-in IAC Driver can route MIDI between apps. Windows needs a MIDI route already exposed by the system or compatible hardware. This is a different setup from Android over USB.
- If the system exposes no suitable output, a web page cannot create a virtual MIDI port. Local playing remains available. No-install support does not mean every browser/computer/DAW combination can connect.

MPE output uses lower-zone note channels 2-6, pitch bend +/-48 semitones and CC74 for vertical expression. Free/Pull/Lock change pitch behavior, not the output protocol. Match the receiving instrument's settings.

Help contains short guides and official documentation links for ten DAWs: Ableton Live, Logic Pro, Cubase, Bitwig Studio, REAPER, Studio One, FL Studio, Pro Tools, Reason and GarageBand. This is a coverage list, not a popularity ranking or a claim of tested full MPE compatibility. End-to-end physical-device recording still requires validation per DAW/version/instrument.

### DAW Compatibility Candidates

Documentation reviewed October 7, 2026. These are **not hardware-tested Glissando certifications**. The USB route and the loaded instrument must both support the workflow.

| DAW | Documented capability / qualification |
| --- | --- |
| Ableton Live 11+ | MPE; enable Track/MPE input and a compatible instrument. |
| Bitwig Studio | MPE; configure input and instrument. |
| Logic Pro (Mac) | MPE/MIDI Mono with compatible instruments. |
| Cubase | MPE/Note Expression in supported versions. |
| REAPER | MPE with compatible instruments and preserved note channels. |
| Studio One 5.3+ | Native MPE support for compatible plugins. |
| GarageBand (Mac) | Instrument-dependent; some built-in sounds lack slide response. |
| FL Studio | Live Channel Through workaround; full MPE recording is not promised. |
| Reason | Not recommended: Reason 14 documents one MIDI channel per VST. |
| Pro Tools | Release-dependent and unconfirmed: 2026 announcement is not proof of shipped support. |

Sources: [Ableton](https://help.ableton.com/hc/en-us/articles/360019144999-MPE-in-Live-FAQ), [ROLI compatibility list, April 2026](https://support.roli.com/en/support/solutions/articles/36000037202-compatible-synths-daws-and-instruments), [GarageBand](https://rolisupport.freshdesk.com/en/support/solutions/articles/36000037232-using-the-seaboard-rise-grand-with-garageband), [FL Studio](https://rolisupport.freshdesk.com/en/support/solutions/articles/36000019138-fl-studio-using-the-seaboard-rise-grand-with-fl-studio-fruity-loops-), [Reason 14](https://docs.reasonstudios.com/reason14/working-with-vst-plugins), [Pro Tools release notes](https://kb.avid.com/pkb/articles/en_US/Knowledge/Pro-Tools-2026-4-Release-Notes).

Before advertising a tested combination, record the phone/tablet model, OS/browser, computer OS, DAW version, instrument/preset and bend range. Test two simultaneous fingers (including the same pitch), independent bends and CC74, recording/playback, note release, unplug/reconnect and offline operation. Current output does not send pressure/aftertouch; presets requiring it need separate validation.

## Home-Screen App And Offline Use

GitHub Pages serves the PWA over HTTPS at the same URL. Adding it to the home screen is optional. Open help > **Glissando app** for installation and offline status. Supporting browsers offer **add to home screen**; otherwise use the browser menu when available. Home-screen access does not unlock unsupported MIDI APIs.

The service worker caches the complete instrument, manifest and local icons after a successful online visit. **Available offline** confirms installation of the offline copy; clearing/evicting browser storage removes it. Analytics are not cached and are not required for playing. The HTML copy editor and its fresh source fetch remain outside the app cache; downloaded HTML still plays without the PWA assets.

New releases wait while the app is open. Help shows an update notice; **update and reopen** applies it only with no active/held/test notes and no other Glissando windows open. There is no automatic reload during playing. Closing all app windows also lets a waiting release activate normally.

Before every deployment containing app changes, run `npm run prepare:pwa` and `npm test`. The release fingerprint covers the HTML, manifest, icons and worker, and tests fail if it is stale. Commit `sw.js` with the changed assets so returning users receive the new offline release. No server build, store submission or native connector is needed.

API and routing references: [Web MIDI](https://www.w3.org/TR/webmidi/), [browser permissions](https://developer.chrome.com/blog/web-midi-permission-prompt), [Apple IAC](https://support.apple.com/en-ie/guide/audio-midi-setup/ams1013/mac), [Android MIDI](https://developer.android.com/reference/android/media/midi/package-summary).

## Local Development

This repo is intentionally small: the instrument and editable UI copy live in `index.html`; the optional PWA adds `manifest.webmanifest`, `sw.js` and `icons/`.

Run the regression checks:

```sh
npm test
```

`test/midi-behavior.test.js` executes the actual inline MIDI module against simulated ports and permissions. For browser checks, run `node scripts/browser-check.cjs` with Playwright available. Optionally set `GLISSANDO_BROWSER` to an installed Chromium/Edge executable, `GLISSANDO_QA_DIR` for screenshots, or `GLISSANDO_URL` to check a deployed build. The browser check measures real Web Audio output but simulates MIDI hardware; it does not certify DAW reception.

`npm run test:pwa` checks a real service worker at a `/glissando/` project path, offline reload/audio, manifest/icons, optional installation UI, update protection for held notes and other windows, and interrupted deployment recovery. Setting `GLISSANDO_URL` checks the published app's manifest and offline operation without deploying test releases. The install prompt is simulated; an Android home-screen installation still needs a physical-device check. `node scripts/render-icons.cjs` regenerates PNG icons from the existing inline logo using Playwright.

Serve locally:

```sh
npx serve .
```

Then open the printed local URL in a browser.

## Notes

The older `build/files` folder in the parent workspace contains a previous WebSocket bridge build. The current GitHub Pages version does not use that bridge; it talks to MIDI devices directly through Web MIDI.
