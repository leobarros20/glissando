# Glissando Chroma Design System

Chroma Light (`chroma`) and Chroma Dark (`chroma-dark`) are two themes of one
instrument UI. Original remains a separate, unchanged legacy presentation.
Everything needed at runtime stays inside `index.html`, including the shared
styles and canvas rendering, so the HTML copy editor and offline app still work.

## Layers

1. Foundations: `[data-design="chroma"]` defines typography, spacing, radii and
   control sizes. These never change between light and dark.
2. Semantic tokens: `[data-skin="chroma"]` and `[data-skin="chroma-dark"]` contain
   matching sets of CSS variables, not component overrides.
3. Primitives: shared control, surface, segmented selection, label, status and
   focus styles consume those tokens. Existing component classes are aliases.
4. Instrument: scale bands, guide lines, touch contacts and readouts consume the
   same theme. Musical state and MIDI routing never depend on appearance.

## Foundations

| Role | Tokens | Values |
| --- | --- | --- |
| UI font | `--font-ui` | Arial, Helvetica, sans-serif; no network fetch |
| Type scale | `--text-xs`, `--text-sm`, `--text-note`, `--text-brand` | 11, 12, 16, 23px |
| Spacing | `--space-1` through `--space-4` | 4, 8, 12, 16px |
| Corner radii | `--radius-sm`, `--radius-control`, `--radius-surface` | 4, 6, 8px |
| Controls | `--control-height`, `--focus-width` | 32px minimum; 2px focus ring |

Toolbar heights stay 50px and 56px because the instrument's existing coordinate
mapping uses that geometry. Icon and appearance controls remain 34px high; native
DAW fields and primary help actions retain their larger existing touch targets.

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
| `.ui-control` | Skin select, `.dd-button`; aliases `.pill`, `.icon-btn` | Shared fill, text, outline, radius and font; hover and visible keyboard focus |
| `.ui-surface` | MIDI panel, help dialog, dropdown menus; alias `.tip-content` | Shared elevated background, border, shadow and radius |
| `.seg-control` / `.seg-opt` | Octave and snap controls | Fixed height; active segment uses accent/on-accent pair |
| `.span-toggle` | Octave span | Inverse/on-inverse active segment, same geometry in either theme |
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

- `Appearance.apply(id, true)` validates the theme ID, sets `data-skin`,
  `data-design` and browser color scheme, and persists only `glissando.skin`.
- `Appearance.refresh()` resolves CSS tokens into a small cached canvas palette
  and updates the browser theme color. It runs after the stylesheet has parsed
  and on theme changes, never inside the animation loop.
- Finger identity stays tied to the original five colors. `Appearance.color()`
  maps identity to the current display palette without replacing active voices.
- Storage denial falls back to the current visit; it cannot block playing.
- Existing saved `chroma` preferences still mean light Chroma. No migration or
  automatic switch to dark is performed.

## Adding Another Theme

Register one validated ID in `Appearance.variants`, add a native select option,
and define the same color-token set under its `data-skin` selector. Set its design
family to `chroma`. Do not copy the primitive or instrument rules. Add persistence,
palette and browser-contrast tests, then regenerate the offline fingerprint.

## Verification

Unit tests enforce matching theme token names and preference validation. Browser
tests compare light/dark geometry, measure key text contrast at >=4.5:1, check
keyboard selection, canvas colors, close-finger MIDI independence, active audio
continuity and responsive bounds. PWA tests verify offline preference restoration
and explicit updates without interrupting held notes.
