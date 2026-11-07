# Glissando UI Primitives

Original (`original`), Chroma Light (`chroma`) and Chroma Dark (`chroma-dark`)
share one instrument UI. Original retains its aurora-style musical feedback.
Everything needed at runtime stays inside `index.html`, including the shared
styles and canvas rendering, so the HTML copy editor and offline app still work.

## Layers

1. Foundations: `:root` defines typography, spacing, radii and control sizes.
   These never change between skins.
2. Semantic tokens: the three `[data-skin]` blocks contain
   matching sets of CSS variables, not component overrides.
3. Primitives: shared control, surface, segmented selection, label, status and
   focus styles consume those tokens. Existing component classes are aliases.
4. Instrument: scale bands, guide lines, touch contacts and readouts consume the
   same theme. Musical state and MIDI routing never depend on appearance.

## Foundations

| Role | Tokens | Values |
| --- | --- | --- |
| UI font | `--font-ui` | Nunito Sans variable Latin; embedded 31 KB WOFF2, system fallback |
| Type scale | `--text-xs`, `--text-sm`, `--text-body`, `--text-note`, `--text-brand` | 11, 13, 14, 16, 24px |
| Spacing | `--space-1` through `--space-4`, `--space-6` | 4, 8, 12, 16, 24px |
| Corner radii | `--radius-sm`, `--radius-control`, `--radius-surface` | 4, 6, 8px |
| Controls | `--control-height`, `--control-inset`, `--focus-width` | 40px; 3px segment inset; 2px focus ring |

Every button, select and segment group uses the same 40px outer height and 12px
horizontal padding. Icon buttons are 40px squares with 18px Lucide glyphs. Segment
children fill the group's inset box, with 8px horizontal padding. Labels use the
same vertical center as their control, not a hand-tuned offset.

Both desktop toolbars are 64px high, plus device safe areas. Below 700px, the
header has two 56px rows: brand/appearance/help, then the horizontally scrollable
musical controls. The bottom bar scrolls, with output and panic first on narrower
screens. All controls remain keyboard- and touch-reachable. Desktop uses 16px
module separation; the mobile musical row uses the existing 8px spacing token.

Nunito Sans and Lucide licenses are included in `licenses/` and in the standalone
HTML. There are no font/icon network requests. Do not add per-skin font, geometry,
padding or control overrides; modify the shared primitive instead.

## Color Roles

- Surfaces: `--color-app`, `--color-surface`, `--color-field`.
- Pitch field: `--color-lane`, `--color-lane-alt`, `--color-grid`, `--color-guide`.
- Text: `--color-text`, `--color-muted`, `--color-disabled`, `--color-link`.
- Boundaries: `--color-border` for separators; `--color-control-border` for inputs.
- Interaction: `--color-hover`, `--color-selected`, `--color-on-selected`,
  `--color-focus`, `--color-inverse`, `--color-on-inverse`.
- Primary action: `--color-accent`, `--color-accent-hover`, `--color-on-accent`,
  `--color-accent-border`. Yellow remains the recognizable primary selection.
- Musical/status roles: `--color-tonic`, `--color-danger`, `--color-danger-border`,
  `--color-success`, `--color-midi`.
- Elevation and readouts: `--shadow-surface`, `--color-readout-mix`.
- Canvas: `--contact-1` through `--contact-5`, `--contact-ring`, `--contact-outline`.

Dark uses neutral graphite surfaces, not a blue-tinted inversion. Its contact
colors are brighter for contrast. Light retains the original Chroma palette,
with stronger control boundaries and darker tonic labels for readability.

## Reusable Primitives

| Primitive | Existing consumers | Behavior |
| --- | --- | --- |
| `.ui-control` | Skin and DAW selects, `.dd-button`; aliases `.pill`, `.icon-btn`, help actions | Shared box model, fill, text, outline, radius and font; hover and visible keyboard focus |
| `.ui-surface` | MIDI panel, help dialog, dropdown menus; alias `.tip-content` | Shared elevated background, border, shadow and radius |
| `.seg-control` / `.seg-opt` | Octave and snap controls | Fixed height; active segment uses accent/on-accent pair |
| `.span-toggle` | Octave span | Native button with keyboard activation and current-range accessible name; inverse active segment |
| `.label-ui` | Musical labels | Small muted UI label |
| `.finger-slot` | Five finger readouts | Tabular data retained; colored note text adapted for each surface |
| `.mode-indicator` / `.dot` | Output connection state | Success, MIDI, mixed-output and disconnected semantics |

Example for a new native field:

```html
<select class="ui-control" aria-label="Example setting">
  <option>Example option</option>
</select>
```

Use `.ui-surface` only for genuine panels, menus and dialogs, not for every page
section. Add command-specific behavior to the existing controller, not to a theme.
Use native `disabled` and semantic labels on new controls. Appearance is not a
reason to duplicate interaction handlers or add a second DOM tree.

## Runtime Contract

### Mobile Screen and Installation

- Touch devices in portrait show a full-width landscape gate. The instrument and
  toolbars are inert until the viewport becomes landscape; opening help or install
  instructions keeps the gate inert behind the existing dialog.
- Entering portrait releases active and held notes and closes portaled dropdowns.
  Merely opening the page, rotating it or installing never asks for MIDI access.
- Fullscreen and rotation are explicit actions. Request fullscreen from the click
  gesture, then attempt a landscape lock. Wait for actual viewport orientation,
  not just promise resolution. Unsupported/denied APIs retain manual guidance.
- Phone landscape toolbars use 56px rows, with the existing 40px controls and
  device safe areas. Desktop and portrait layout keep the shared sizing rules.
- Install PWA is visible on the main toolbar and portrait gate. A captured
  beforeinstallprompt is single-use; without it, a separate view gives short
  Android, iPhone/iPad or desktop instructions. Cancellation is not an installation.
- All install buttons share the same embedded Lucide download/loading icons. Busy
  states retain their geometry, disable duplicate requests and expose aria-busy.
  The status row uses the same spinner and respects reduced motion. No percentage
  is shown because browsers do not expose installation progress.
- Accepting a prompt waits up to 30 seconds for appinstalled. Cancellation, errors
  and missing confirmation stop the spinner without claiming success. A late
  confirmation still works. Manual Safari installation never shows fake progress.
- appinstalled updates the persistent install status and a polite, nonblocking
  toast. It does not open a dialog, request notification permission or steal focus.
  The toast uses the shared ui-toast primitive and lasts 10 visible seconds;
  backgrounding preserves it until the user returns. Android copy allows for the
  OS icon to appear later, since appinstalled can precede WebAPK creation.
- The manifest requests fullscreen and landscape. Browsers may fall back to a
  supported display mode. Installed standalone/fullscreen/minimal-ui launches hide
  install buttons; a regular tab using the Fullscreen API is not marked installed.
- ScreenMode owns orientation/fullscreen. AppShell owns installation and offline
  updates. Neither changes the pitch or MIDI routing model.

Browser constraints: [orientation lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock),
[install prompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event),
[installation detection](https://web.dev/learn/pwa/detection),
[iPhone home-screen apps](https://support.apple.com/en-eg/guide/iphone/iphea86e5236/ios).

### Appearance

- `Appearance.apply(id, true)` validates the theme ID, sets `data-skin`,
  `data-design` and browser color scheme, and persists only `glissando.skin`.
- `Appearance.refresh()` resolves CSS tokens into a small cached canvas palette
  and font, and updates the browser theme color. It runs after the stylesheet has parsed
  and on theme changes, never inside the animation loop.
- Finger identity stays tied to the original five colors. `Appearance.color()`
  maps identity to the current display palette without replacing active voices.
- Storage denial falls back to the current visit; it cannot block playing.
- Existing saved `chroma` preferences still mean light Chroma. No migration or
  automatic switch to dark is performed.
- `GridView` places each stripe's left edge at the exact percentage used for the
  note guide and label. Stripes run note-to-note; no half-step visual offset.
- A ResizeObserver caches the playable field's bounds. Guide bending uses these
  bounds, not hard-coded toolbar heights; no layout read occurs in the audio loop.
- `fitLabels()` prioritizes tonics and omits colliding labels on dense scales. It
  runs on rebuild, font readiness and skin changes. It never moves note positions.
- Help's close control is sticky and shares the back button's baseline. All
  dropdowns, panels and tooltips use the same surface primitive.

## Adding Another Theme

Register one validated ID in `Appearance.variants`, add a native select option,
and define the same color-token set under its `data-skin` selector. Set its design
family to `chroma`. Do not copy the primitive or instrument rules. Add persistence,
palette and browser-contrast tests, then regenerate the offline fingerprint.

## Verification

Unit tests enforce matching theme token names and preference validation. Browser
tests compare light/dark geometry, measure key text contrast at >=4.5:1, check
keyboard selection, canvas colors, close-finger MIDI independence, active audio
continuity, 40px controls, baseline alignment, sticky help navigation, stripe
boundaries and non-overlapping labels across every scale and octave span. PWA
tests verify the embedded font and saved skin offline, and explicit updates
without interrupting held notes. Hardware DAW reception is not certified by mocks.
