# Chroma Skin QA

Date: 2026-10-18

final result: passed

## Scope and Visual Target

The user selected the third displayed concept and requested an optional skin first,
not a replacement interface. Original remains the default. Chroma changes presentation
without moving pitch coordinates, restructuring musical controls, or changing MIDI.

- Source: `C:/Users/leo20/.codex/generated_images/019f06b2-e682-7130-9f6b-09276c069f4b/exec-8dda583e-e44d-4c46-ab92-557d5bfa1104.png`
- Implementation: `C:/Users/leo20/Desktop/work/paye/apps/glissando/qa-skins/chroma/chroma-reference-playing.png`
- Source and implementation: 1448 x 1086 pixels, no device frame or browser chrome.
- Browser viewport: 1448 x 1086 CSS pixels, deviceScaleFactor 1. No density resampling.
- State: Chroma, C major, two octaves, free pitch, three moving contacts, MIDI output.
- Both images were opened together in one comparison input after the final CSS fixes.

The source is a concept, not a captured working instrument. In the implementation,
the same contact positions correctly report E4, C5 and G#5 rather than the concept's
illustrative E4, C5 and G5. Actual pitch mapping was deliberately preserved.

## Findings and Comparison History

No actionable P0/P1/P2 findings remain within the skin-only scope.

1. Initial implementation inspection found residual blue tonic guides and inherited
   glow effects, unlike the reference's quiet pitch field. Fixed selector specificity
   for all Chroma guide paths. Re-captured at the same viewport with three contacts;
   idle guides are now transparent and active feedback uses thin, non-glowing lines.
2. Initial help and MIDI screenshots retained letter spacing from higher-specificity
   legacy styles. Added scoped overrides and darkened the small colored finger text.
   Re-captured help, output and instrument states on desktop, tablet and phone.
3. Final combined source/implementation comparison confirmed the neutral alternating
   lanes, red tonic labels, yellow selected snap mode, solid colored contact markers,
   separate black/white outlines and restrained trails.

## Required Fidelity Surfaces

- Typography: local Arial/Helvetica sans-serif with bold wordmark and note labels.
  No remote font dependency. The concept's large display typography is intentionally
  reduced to fit the existing toolbar. Help copy remains readable and wraps correctly.
- Layout: existing 50px top and 56px bottom bars, note coordinates and scrollable
  musical controls retained. Appearance and help are always visible, outside the
  scrolling toolbar. Note labels move to the bottom only in Chroma. Bands align to
  the actual scale grid rather than a decorative repeating background.
- Colors: silver/white field, near-black text, cobalt/red/jade contacts, yellow active
  snap segment. Help, native select, dropdowns, MIDI output and focus states use the
  light palette. Original keeps its dark field and original contact rendering.
- Imagery: the reference contains an instrument UI, not photographic assets.
  Live canvas contacts and functional pitch regions remain programmatic. No raster
  mockup was substituted for the instrument. No new illustrative asset or imitation
  of the concept's red wave logo was added; this is a skin, not a brand redesign.
- Copy: existing musical labels and connection guidance retained. The new native
  control reads `Skin: Original` / `Skin: Chroma` and has an accessible `Skin` label.
  Contact labels show real current pitches, and are suppressed if they would overlap
  other contact markers or labels.

The source and implementation were readable at native resolution. Focused inspection
covered the top control strips, contact rings/trails, bottom note labels and finger
readouts within the full-size comparison. Separate mobile help and MIDI captures
were inspected for text wrapping, panel boundaries and color consistency.

## Verification

- 40 unit tests pass, including new preference validation, storage denial, palette
  identity, restoration before paint and persistence tests.
- Browser regression runs pass independently for Original and Chroma at 1280 x 720,
  1024 x 768, 390 x 844 and 844 x 390; reference capture also at 1448 x 1086.
- Native selector works with pointer selection and keyboard arrows. Choice survives
  reload, offline launch and explicit app update.
- Switching skins with an active note preserves the AudioContext, measured audio
  signal, note coordinates and permission state.
- Switching with two close touches does not emit extra MIDI note-on or note-off
  messages. Independent MPE channels and their releases remain intact.
- First-touch sound, all four help exits, output selection, hot-plug fallback and
  reconnection pass with browser MIDI mocks. Canvas pixel checks confirm visible
  contacts, in addition to screenshot inspection.
- PWA offline, held-note update guards, multiple-window guards and failed-precache
  recovery pass. Zero page errors in all browser runs.
- Evidence directories: `qa-skins/chroma`, `qa-skins/original`, `qa-skins/pwa` under
  `C:/Users/leo20/Desktop/work/paye/apps/glissando/`.

## Intentional Differences and Residual Risk

- The concept rearranges controls and removes finger readouts; this implementation
  deliberately preserves them. Compact phone toolbars still scroll horizontally.
- Browser-level Web MIDI was mocked. No physical phone/USB/DAW or iOS rendering
  certification is claimed. Existing platform compatibility limits are unchanged.
- Local-storage restrictions can prevent persistence; skin selection still works
  for the current visit. No unrelated preferences are written.

## Implementation Checklist

- [x] Keep Original available and default.
- [x] Add always-visible native skin selector and saved preference.
- [x] Apply Chroma consistently to instrument, help, menus and output controls.
- [x] Preserve musical state, touch identity and MIDI behavior.
- [x] Verify responsive screenshots, browser interactions and offline behavior.
- [x] Refresh the offline release fingerprint.

## Follow-up Polish

- A future layout redesign can adopt the concept's larger control groups. That is
  intentionally separate from this selectable skin and was not required for release.
