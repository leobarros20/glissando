# PWA Installation Feedback QA

Date: 2026-11-07

- Shared loading icons checked while the native prompt is pending and after
  acceptance. Button bounds stay unchanged; repeat requests are disabled.
- Cancellation, prompt errors and a 30-second missing-confirmation fallback stop
  loading. Fake-clock checks avoid real waiting. appinstalled before prompt
  resolution and after acceptance retain confirmed status and cancel the timeout.
- Confirmation is visible after closing help, never opens a dialog, never steals
  focus and cannot intercept touches. Its dismissal timer pauses while hidden.
- Dark/light portrait and landscape screenshots inspected in workspace
  qa-install-feedback. Reduced motion disables the spinner animation.
- Manual Safari instructions show no invented progress. Android confirmation
  explicitly allows time for the OS icon to appear. No physical installation
  completion is inferred from mocked browser events.
- All 44 unit tests and screen/PWA browser checks passed, including offline audio
  and guarded updates. Test browsers and temporary servers closed after each run.

## Landscape and PWA QA

Date: 2026-11-07

- Portrait gate tested at 320x568, 390x844 and 768x1024 with touch input. Landscape
  restores the instrument at 844x390. No initial audio or MIDI permission request.
- Fullscreen is requested before the landscape lock. A fulfilled lock promise
  alone does not dismiss the gate. Real desktop browser fullscreen entry/exit,
  rejected APIs, unavailable APIs and manual rotation fallbacks passed.
- Browser installation: native prompt acceptance, cancellation, error, reuse
  prevention and appinstalled confirmation tested with deterministic API mocks.
  Android and Safari manual installation guidance inspected in screenshots.
- Installed standalone, fullscreen and minimal-ui modes hide the install actions.
  Regular browser fullscreen keeps installation available.
- Returning to portrait releases held notes, closes portaled menus and prevents
  playing behind the gate. Help remains accessible and returns to the gate.
- Regression suite passed: audio after help, independent MPE fingers, skin changes,
  responsive geometry, manifest scope, offline playing and safe update behavior.
- 44 unit tests passed. Screenshots: workspace qa-landscape/screen, /pwa and
  /regression. Browser and temporary server processes close in test cleanup.
- Limits: phone OS rotation and real installation were not exercised on hardware.
  Install and orientation APIs are partly simulated; desktop fullscreen is real.

## Archived Review: UI Consolidation

Date: 2026-10-25

## Scope and Evidence

Refine the selected Chroma direction, preserve all three skins and the musical
behavior. Current-run before/after captures are in the workspace's
`qa-ui-polish/{before,light,dark,original,pwa}` directories. No new visual concept
or alternate app was introduced.

1. Instrument: corrected half-note stripe offset. Stripe boundaries, labels and
   guide anchors now share a coordinate. Nunito Sans is embedded; desktop and
   mobile controls share a 40px height, consistent padding and centered labels.
   Narrow headers separate appearance/help from the scrollable musical row.
2. Output: selects, action buttons and status rows use the shared primitives.
   The existing permission, hot-plug, test-note and fallback flows passed.
3. Help: shared type scale and control sizing, including the DAW field. Close
   remains visible while scrolling and aligns with Back. All four help exits
   still allow measured browser audio.
4. Dense scales: tonic-priority label fitting avoids collisions at 320px without
   changing pitches. Keyboard range selection and every scale/span were tested.
5. Offline app: embedded font and skin survive offline reload; updates preserve
   held notes, enforce the other-window guard and retain a complete older cache
   if the next release cannot be fully cached.

## Validation

- 44 unit tests passed; `git diff --check` passed.
- Playwright/Edge screenshots inspected at 320, 390, 844, 1024, 1280, 1448 and
  1920px widths. Scripted checks cover shared geometry, readable semantic text
  contrast, panel bounds, active canvas pixels, audio and independent MPE channels.
- Additional checks cover 40px controls, group alignment, label/stripe/guide
  coordinates, font availability and keyboard range activation.
- Remaining constraints: narrow toolbars intentionally scroll; a physical phone
  and hardware DAW were not available. MIDI tests use mocked ports. This is not
  a complete accessibility or real-device certification.

## Archived Review: Chroma Light / Dark

Date: 2026-10-24

final result: passed

## Dark Theme and Shared Primitives

The latest request adds a dark variant of the existing Chroma skin, with a coherent,
replicable design system. The live light skin is the layout reference; color is an
intentional variation, not a new layout. Original remains the default and existing
saved `chroma` preferences continue to select light Chroma.

- Reference: `C:/Users/leo20/Desktop/work/paye/apps/glissando/qa-chroma-dark/light/chroma-reference-playing.png`
- Dark implementation: `C:/Users/leo20/Desktop/work/paye/apps/glissando/qa-chroma-dark/dark/chroma-reference-playing.png`
- Both images: 1448 x 1086 pixels, 1448 x 1086 CSS viewport, deviceScaleFactor 1.
  No crop, device chrome or density normalization was needed.
- State: C major, two octaves, free pitch, the same three contact positions and MIDI
  output. Both screenshots were opened together in a single comparison input.
- Focused checks: toolbar and snap selection, canvas labels, contact rings, note
  labels and readouts. Additional open-menu and 320px mobile screenshots were viewed
  for control clipping and legibility; mobile help/output panels were also inspected.

Findings and fixes:

- Initial light-theme contrast testing found tonic red below 4.5:1 on the alternating
  lane. Changed the semantic tonic token to `#bd2c22`; the final light browser run
  and re-captured screenshots pass. No actionable P0/P1/P2 finding remains.
- Settled selected-segment colors are measured after their existing color transition,
  rather than treating an interpolated switch frame as the final state.

Required surfaces:

- Typography: one shared local font family and size scale; no theme-specific font
  overrides. Labels and control text wrap or fit within their existing bounds.
- Layout: identical light/dark geometry is asserted for bars, selector, note labels
  and pitch bands. Shared control sizes, spacing and radii are defined once.
- Colors: dark uses neutral graphite, brighter contact colors, light text and the
  same yellow selection cue. Key body, muted, tonic, link, selected and inverse text
  pairs pass 4.5:1. Help, dropdowns, output, status and focus use semantic tokens.
- Imagery: the live canvas instrument remains interactive. No screenshots or assets
  are used to fake musical controls; canvas-pixel checks verify painted contacts.
- Copy: only the new `Skin: Dark` option was added. Existing instructions and musical
  terminology remain unchanged.

Verification for this revision:

- 42 unit tests pass. New checks cover dark restoration, matching token sets,
  CSS-driven canvas colors and rejection of inherited object-property IDs.
- Browser regressions pass for Original, Chroma and Dark at 320 x 568, 390 x 844,
  844 x 390, 1024 x 768, 1280 x 720 and 1920 x 1080, plus the reference viewport.
- Active audio, pitch coordinates and independent MPE note channels survive skin
  changes. All help exits still produce measured audio; zero page errors.
- Offline reload and explicit update retain Dark; held notes and other open windows
  still block an automatic interruption. Incomplete precache recovery passes.
- Design contract and extension instructions: `design-system.md`. Shared primitives
  are `.ui-control`, `.ui-surface` and the existing segmented/status/readout controls.
- MIDI is browser-mocked for these tests; physical phone/USB/DAW testing remains
  outside this appearance-only change. Legacy horizontal toolbar scrolling remains.

## Earlier Light-Skin Review (2026-10-18)

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
