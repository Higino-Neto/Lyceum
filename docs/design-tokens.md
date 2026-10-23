# Semantic Design Tokens

Lyceum uses a semantic color layer instead of component-level palette classes.
Components describe the role of a color (`background`, `primary`, `destructive`,
`border`) and the theme/accent layer decides which concrete value that role
receives.

This document covers the token source, runtime application, the completed
component migration, compatibility layer, isolated viewer integrations, tests,
and remaining risks.

## Why Semantic Tokens

The previous implementation mixed three concerns in component class names:

1. **Appearance** (light/dark) was expressed through `zinc-*` values.
2. **Accent** was expressed through `green-*` values.
3. **Meaning** was implicit in individual components.

That made light mode depend on a large `!important` remap and made adding a new
accent a search-and-replace exercise. Semantic tokens invert the dependency:
palettes are primitives, tokens are the public contract, and components only
consume the contract.

Rules for new code:

- Use semantic utilities such as `bg-background`, `text-foreground`,
  `bg-primary`, `border-border`, or the matching CSS variables (`--background`,
  `--primary`, `--border`).
- Do not use `zinc-*`, `green-*` or another palette family directly in UI code.
- Do not add selectors to the legacy remap block in `src/index.css`.
- Do not use `!important` to force theme colors in new component styles.

## Source of Truth

| File | Responsibility |
| --- | --- |
| `src/theme/palettes.ts` | Accent primitives (`ACCENT_COLORS`, 50–950 scales) and safe accent lookup. |
| `src/theme/tokens.ts` | Semantic token catalog and deterministic light/dark + accent resolution. Also exports `DARK_TOKENS`, `LIGHT_TOKENS`, `toCssCustomProperties`, and `contrastRatio`. |
| `src/theme/appearance.ts` | Persisted appearance parsing, effective-theme resolution, and the single document write path (`applyThemeToDocument`). |
| `src/theme/boot.ts` | Applies the stored appearance before React mounts. |
| `src/index.css` | Maps semantic tokens to Tailwind v4 utilities through `@theme inline` and hosts the temporary legacy remap. |
| `index.html` | Pre-paint theme class/background resolution and script ordering. |
| `electron/main.ts` | Native window background derived from the same token source; window becomes visible on `ready-to-show`. |

The token catalog is defined once in TypeScript. The CSS layer maps names to
runtime variables; it does not define a second set of color values.

## Runtime Flow

### Before React

1. The inline script in `index.html` reads `lyceum:app-settings` from
   `localStorage`, resolves `system` against `prefers-color-scheme`, and adds
   `lyceum-theme-light` or `lyceum-theme-dark` plus a pre-paint background. It
   does not duplicate the palette.
2. `src/theme/boot.ts` runs before `src/main.tsx`. It reads the same settings and
   calls `applyThemeToDocument`, which writes every semantic variable and the
   legacy accent variables to `<html>`.
3. Electron creates the window with the OS-appropriate token background and
   waits for `ready-to-show` before showing it.

### Inside React

`AppSettingsProvider` remains the public settings API. It still owns:

- `settings`, `effectiveTheme`, and all existing setters.
- The `lyceum:app-settings` localStorage key.
- System theme change listeners.
- `reducedEffects`.

On every appearance/accent change it calls the same `applyThemeToDocument`
used by the boot script. React never rewrites component class names for theme
changes; only CSS custom properties on `<html>` change.

### Tailwind v4 Mapping

`src/index.css` contains:

```css
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ...one entry per semantic token... */
}
```

`inline` makes generated utilities reference the runtime variables directly.
This produces utilities such as:

- `bg-background`, `text-foreground`
- `bg-surface`, `bg-surface-muted`
- `text-foreground-muted`, `text-foreground-subtle`
- `border-border`, `border-border-strong`
- `bg-primary`, `text-primary-foreground`, `hover:bg-primary-hover`
- `bg-primary-muted`, `border-primary-border`
- `ring-focus-ring`
- `bg-destructive`, `text-destructive`, `bg-success-muted`

## Token Catalog

### Base and chrome

| Token | Role | Dark | Light |
| --- | --- | --- | --- |
| `background` | Application background | `#09090b` | `#f4f5f7` |
| `foreground` | Primary text and icons | `#f4f4f5` | `#111827` |
| `surface` | Cards, panels, raised areas | `#18181b` | `#fcfcfd` |
| `surface-muted` | Recessed/secondary surfaces | `#27272a` | `#f2f4f7` |
| `foreground-muted` | Secondary text | `#a1a1aa` | `#52525b` |
| `foreground-subtle` | Hints and tertiary text | `#82828c` | `#64748b` |
| `border` | Default dividers | `#27272a` | `#e4e4e7` |
| `border-strong` | Controls and emphasized borders | `#3f3f46` | `#cbd5e1` |
| `input` | Editable field background | `#18181b` | `#ffffff` |
| `input-border` | Editable field border | `#3f3f46` | `#cbd5e1` |
| `input-placeholder` | Field placeholder | `#8a8a93` | `#94a3b8` |
| `overlay` | Floating chrome | `rgb(24 24 27 / 0.95)` | `rgb(255 255 255 / 0.96)` |
| `backdrop` | Modal dimming | `rgb(0 0 0 / 0.5)` | `rgb(15 23 42 / 0.4)` |
| `shadow` | Shadow color | `rgb(0 0 0 / 0.4)` | `rgb(15 23 42 / 0.12)` |

### Accent-derived

These roles follow the selected accent and remain independent from light/dark
selection. Concrete values below use the default green accent.

| Token | Role | Dark (green) | Light (green) |
| --- | --- | --- | --- |
| `primary` | Primary action/selected state | `#4ade80` (400) | `#15803d` (700) |
| `primary-hover` | Primary hover | `#86efac` (300) | `#166534` (800) |
| `primary-foreground` | Content on primary | `#052e16` (950) | `#ffffff` |
| `primary-muted` | Soft selected background | 18% primary mix | 12% primary mix |
| `primary-border` | Soft primary border | 42% primary mix | 38% primary mix |
| `selection` | Text/item selection | 30% primary mix | 30% primary mix |
| `selection-foreground` | Content in a selection | `#fafafa` | `#0b1220` |
| `focus-ring` | Keyboard focus outline | `primary` | `primary` |
| `link` | Inline/standalone links | 300 step | 700 step |

Dark surfaces use the brighter `400` step with the accent `950` step as
foreground. Light surfaces use the deeper `700` step with white. The test suite
checks every accent/theme combination against WCAG AA (4.5:1) for primary text.

### Status

| Token | Role |
| --- | --- |
| `success`, `success-muted` | Positive text/icons and soft background |
| `success-foreground` | Text/icons on a solid `success` surface |
| `warning`, `warning-muted` | Warning text/icons and soft background |
| `warning-foreground` | Text/icons on a solid `warning` surface |
| `destructive`, `destructive-hover`, `destructive-foreground`, `destructive-muted` | Errors and destructive actions |
| `info`, `info-muted` | Informational text/icons and soft background |
| `info-foreground` | Text/icons on a solid `info` surface |

Solid status surfaces (`bg-warning`, `bg-info`, …) always pair with their
matching `*-foreground` token. Soft surfaces (`*-muted`) pair with the status
color itself (for example `bg-primary-muted text-primary` or
`bg-warning-muted text-warning`), never with the solid-surface foreground.

Status colors are theme-specific but not accent-specific. They use literal
values or `color-mix(...)` against transparent, so they adapt to the current
surface without a new token per theme.

## Accent Palettes

Selectable accents are defined in `src/theme/palettes.ts`:

| Id | Label | Steps |
| --- | --- | --- |
| `green` | Verde | 50–950 |
| `blue` | Azul | 50–950 |
| `violet` | Violeta | 50–950 |
| `amber` | Âmbar | 50–950 |
| `rose` | Rosa | 50–950 |
| `cyan` | Ciano | 50–950 |

Unknown accent ids deterministically fall back to `green`. Palette values are
never interpolated into CSS property names, so untrusted persisted values cannot
inject CSS.

`applyThemeToDocument` also writes the legacy `--accent-50` … `--accent-950` and
`--accent-foreground` variables. They exist only for components still covered by
the compatibility layer.

## Persistence and Compatibility

The public `AppSettingsContext` contract is unchanged:

- storage key: `lyceum:app-settings`
- `theme`: `system | light | dark`
- `accentColor`: one of the accent ids
- `reducedEffects`: boolean
- setters and `useAppSettings()` behave as before

Invalid persisted `theme` or `accentColor` values are sanitized on load rather
than trusted. Missing fields keep their defaults.

### Legacy remap

`src/index.css` retains a bounded compatibility region:

```text
LEGACY COLOR REMAP START — TEMPORARY COMPATIBILITY LAYER
...
LEGACY COLOR REMAP END
```

It intercepts any remaining `zinc-*` and `green-*` utilities in third-party or
generated markup so it still follows theme/accent changes. The region:

- is explicitly temporary;
- must not receive new selectors;
- should only shrink as consumers disappear;
- is checked by `scripts/check-design-tokens.mjs`, which rejects legacy
  `!important` remaps outside the markers and legacy classes or variables in
  every user-visible source module.

All first-party UI modules have moved to semantic tokens, so the region no
longer has known consumers in `src/`. It is kept as a safety net for embedded
or generated markup until a visual pass confirms it can be deleted.

The light-mode selectors inside the region are the riskiest part: they use
higher specificity and `!important` to override component styles. They are a
bridge, not a pattern to copy.

## Pre-Paint and Window Behavior

FOUC (flash of unstyled or wrong-theme content) is handled at three levels:

1. **HTML pre-paint**: the inline head script applies the theme class and a
   fallback background before CSS or React loads. The fallback colors are
   checked against `DARK_TOKENS.background` / `LIGHT_TOKENS.background`.
2. **Boot module**: `src/theme/boot.ts` applies the full token set before the
   React entry point.
3. **Electron window**: `electron/main.ts` derives its `backgroundColor` from the
   token source, follows `nativeTheme` updates, creates windows hidden, and shows
   them on `ready-to-show`.

The main process can only know the OS appearance, not a renderer's explicit
light/dark preference stored in localStorage. The pre-paint script closes that
gap for the page itself.

## Isolated Contexts

### PDF.js viewer

The PDF viewer runs in an isolated iframe/document with its own origin and
stylesheet. Parent CSS variables are not inherited, so color cannot be fixed by
adding a class to the host alone.

The integration is:

1. The host resolves `resolveThemeTokens(effectiveTheme, accentColor)`.
2. `PdfJsViewer` posts `CMD_SET_THEME` over the existing versioned bridge with
   `{ theme, colors }`, containing every semantic token value.
3. `resources/pdfjs-viewer/features/theme/index.mjs` validates the payload and
   writes `--lyceum-<token>` variables on the viewer document.
4. `resources/pdfjs-viewer/lyceum-pdfjs.css` consumes only those variables.
   Its hard-coded values are dark fallbacks for the first paint before the host
   sends `CMD_SET_THEME`.
5. The host re-sends the theme on iframe load, viewer ready, document ready,
   and whenever theme/accent changes.

The shared contract is in `src/core/pdf-reader-core/contract.ts`.
`resources/pdfjs-viewer/lyceum-core.mjs` is generated from it with
`node scripts/build-lyceum-core.mjs`; do not edit the generated file.

### EPUB content

EPUB chapter content is rendered in its own document and does not inherit host
variables. The reader's content theme (`light`, `dark`, `sepia`) is intentionally
independent from the application accent so the book page keeps a consistent
reading surface. `src/pages/ReadingPage/components/epub-reader/theme.ts` uses
explicit literals for this reason; it must not depend on `--ui-*` or semantic
host variables that are unavailable inside the chapter document.

Reader chrome outside the chapter document is part of the host app and uses
semantic utilities; only the chapter document itself keeps literal theme
values.

## Migration Inventory

Every user-visible module under `src/` now consumes semantic utilities or
semantic CSS variables. The static checker walks the entire source tree rather
than a hand-maintained list, so new files are covered automatically. The scan
excludes only:

- `src/test/**` — assertions legitimately name token classes;
- `src/theme/**` — the layer that defines the tokens and the legacy accent
  bridge;
- `src/index.css` — the Tailwind mapping and the bounded legacy remap.

Migrated areas include:

- **Shell and navigation:** `App`, `TitleBar`, `Sidebar`, `SidebarItem`,
  `tabs/TabBar`, `tabs/TabItem`.
- **Shared surfaces:** `Skeleton`, `StatCard`, `Logo`, `ui/AnimatedModal`,
  `ui/Select`, all `components/skeletons/*`.
- **Dialogs and forms:** `ConfirmDialog`, `EditReadingDialog`,
  `ImportBookDialog`, `SetThumbnailDialog`, `BookSearchInput`,
  `settings/SettingsDialog`, all of `settings/SettingsPanels`, and the auth
  components/pages.
- **Pages:** Dashboard (charts, heatmap, ranking, streak, stat cards), Library
  (grid, list, folders, filter bar, detail panel, metadata search), Atlas
  (status board and concept views), Conversion, Habit Tracker, Reading Page
  (session timer/modal, EPUB chrome, PDF annotation panels and chapter
  sidebar), and the auth/error/not-found routes.
- **Mobile app:** every screen plus `mobile.css` and `PdfPane.css` chrome.
  `src/mobile/main.tsx` imports `src/theme/boot.ts`, so the mobile build
  receives the same pre-React semantic variables even though it does not mount
  `AppSettingsProvider`.
- **Host-side integrations:** toaster styling, chart palettes, drag previews,
  Sigma concept graphs, and the reading heatmap now read tokens (or resolved
  `getComputedStyle` values where a canvas/SVG library cannot use CSS
  variables).

### Intentional content-color exceptions

Some colors describe content rather than chrome and must stay literal:

- PDF page previews and page rendering filters (`paper`, `sepia`, `night`) in
  `src/mobile/PdfPane.tsx`, `PdfPane.css`, and the isolated PDF viewer.
- EPUB chapter themes (`src/pages/ReadingPage/components/epub-reader/theme.ts`)
  because chapter documents do not inherit host variables.
- Annotation/highlight palettes and their persisted colors, including text
  highlighting in `src/mobile/TextPane.tsx` and thumbnail extraction.
- PDF viewer first-paint fallbacks in `resources/pdfjs-viewer/lyceum-pdfjs.css`.

These are data or book-page colors, not UI roles. They are documented here so a
future cleanup does not mistake them for migration gaps.

### Isolated viewer boundaries

`PdfJsViewer.tsx` is a host frame and uses semantic tokens. The viewer internals
use only the `--lyceum-*` variables pushed through `CMD_SET_THEME`; they are not
expected to read host `--background`/`--primary`. EPUB chrome uses semantic
tokens, while chapter content keeps its own theme literals.

## Verification

### Automated tests

- `src/test/theme/tokens.test.ts`: token completeness, accent independence,
  light/dark resolution, WCAG contrast, and CSS custom-property mapping.
- `src/test/theme/appearance.test.ts`: theme validation/resolution, persisted
  payload sanitization, and document application.
- `src/test/theme/AppSettingsContext.theme.test.tsx`: provider hydration,
  persistence, document updates, system theme changes, and invalid input.
- `src/test/pdfBridgeProtocol.test.ts`: `CMD_SET_THEME` and viewer theme payload
  validation.
- `src/test/theme/designTokens.static.test.ts`: runs the static checker.

### Static checker

```bash
npm run check:tokens
```

`scripts/check-design-tokens.mjs` verifies:

- every semantic token has dark and light values;
- `@theme inline` maps every token and no non-token color;
- `index.html` fallback backgrounds match the token source and boot order;
- Electron uses token backgrounds and `ready-to-show`;
- every user-visible source file (all non-test, non-theme `.ts`/`.tsx` under
  `src/`) contains no palette-family classes (`zinc-*`, `green-*`, `red-*`,
  `blue-*`, and the other Tailwind palettes), no `var(--ui-*)`, and no
  `var(--accent-*)` reads;
- legacy `!important` remaps stay inside the marked region;
- the generated PDF core is current and the isolated viewer consumes
  `--lyceum-*` only;
- the EPUB content theme has no unavailable host variables.

`npm run check:tokens` is part of the broader `npm run check` pipeline.

## Risks and Known Limitations

- **Legacy remap specificity**: light-mode overrides rely on `!important` and
  class-attribute selectors. No first-party source uses the remapped classes
  anymore, so the region should be removed after a manual visual pass; until
  then, embedded/generated markup can still hit it.
- **Token fallbacks in imperative APIs**: canvas, Sigma, and similar APIs cannot
  consume CSS variables directly. Those call sites resolve tokens with
  `getComputedStyle` and keep the previous literal as a fallback, so a token
  rename must update both places.
- **Inline fallback duplication**: `index.html` intentionally repeats two
  background values for pre-paint safety. The static checker prevents drift, but
  the values still exist in two places.
- **Explicit preference vs native chrome**: the Electron window background
  follows the OS, not an explicit in-app preference. The page itself is correct
  pre-paint; only the OS-drawn backing color can differ briefly.
- **Color function support**: tokens use `color-mix(...)`. Supported Chromium
  versions (Electron 30 and current mobile WebViews) handle it; very old
  embedders would need fallbacks.
- **PDF viewer snapshot**: the viewer receives resolved values, not palette
  ids. A future theme change must always re-send `CMD_SET_THEME`; there is no
  media-query fallback for accent.
- **EPUB separation**: the book content will not follow app accent changes by
  design. This should be documented in reader UX if users expect otherwise.
- **No visual regression suite yet**: contrast is verified numerically, but
  screenshots are not compared across themes.

## Next Steps

1. Manually verify every screen in light/dark and at least one non-default
   accent; check selected, disabled, loading, empty, and error states.
2. Delete the legacy remap region from `src/index.css` once the visual pass
   confirms no generated or embedded markup depends on it, then tighten the
   checker to reject the markers outright.
3. Add component-level screenshot tests for light/dark plus one non-default
   accent.
4. Consider a user-facing “reduce transparency” variant for `overlay` and
   `backdrop` if `color-mix` fallbacks become necessary.
5. Revisit EPUB content theming only if product requirements call for matching
   the app accent; keep the isolated-document constraint explicit.
6. Audit imperative color consumers (canvas, Sigma, PDF) whenever tokens change,
   since their fallbacks are literals by necessity.

## Checklist for New Color Tokens

1. Add the role to `SEMANTIC_TOKENS` in `src/theme/tokens.ts`.
2. Add explicit dark and light values (or accent-derived logic).
3. Add the mapping in `@theme inline` in `src/index.css`.
4. Add or update contrast tests in `src/test/theme/tokens.test.ts`.
5. Use the semantic utility or `var(--token)` in components.
6. Run `npm run check:tokens` and the theme tests.
7. If the token is needed in the isolated PDF viewer, add it to the viewer CSS
   and ensure the host sends all semantic values through `CMD_SET_THEME`.
