# PDF.js source in Lyceum

This directory is the Mozilla PDF.js source at release `v4.10.38` (Apache-2.0;
see `LICENSE`). It is the **only** source for the desktop generic viewer.
`scripts/prepare-pdfjs.mjs` installs this tree's locked dependencies when
needed, runs `gulp generic`, and copies its build plus Lyceum overlays into
ignored `public/pdfjs/`. A missing or incompatible build fails the Lyceum build.

For Lyceum features, prefer `resources/pdfjs-viewer/` and the typed React
adapter. Change upstream `web/` only for behavior that an overlay cannot
implement. Change `src/display/` or `src/core/` only when rendering or PDF
parsing itself must change. Keep each upstream change isolated and describe it
in this file so a future upstream rebase can replay or discard it.

Local upstream changes:

- `web/app.js`: accept only hash-addressed `lyceum-pdf://document/` URLs.
- `web/viewer.js`: dispatch `webviewerloaded` on the iframe document so the
  cross-origin Lyceum bridge can configure PDF.js before startup.
- `src/display/editor/ink.js`: finish an ink annotation when the pen is lifted,
  so distant strokes remain independently selectable objects.
- `web/pdf_viewer.js`: preserve the gesture origin during pinch/trackpad zoom
  instead of snapping the scroll position to the current page first.
