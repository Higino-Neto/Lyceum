# Lyceum PDF.js integration

The Mozilla PDF.js source is vendored in `vendor/pdfjs-4.10.38`.
Files in this directory are Lyceum-specific runtime overlays copied into
`public/pdfjs/lyceum` by `scripts/prepare-pdfjs.mjs`.

In development, Electron serves this overlay directly from `resources/pdfjs-viewer`.
The Vite watcher reloads the PDF iframe when an overlay file changes and rebuilds
`lyceum-core.mjs` when `src/core/pdf-reader-core` changes. The production build
still copies the prepared overlay into `dist/pdfjs`.

The viewer is built from source on every prepare/build. Keep upstream changes
small and documented; put Lyceum protocol, reading-state, and visual integration
code here.

- `index.mjs` bootstraps the viewer and installs the feature modules in
  `features/`, backed by the wiring in `core/`. It also exposes a read-only
  `globalThis.LyceumPdfJs` diagnostics surface for the Electron smoke test.
- `lyceum-messaging.mjs` owns the versioned cross-frame transport.
- `lyceum-core.mjs` is a generated bundle (do not edit) produced by
  `scripts/build-lyceum-core.mjs` from `src/core/pdf-reader-core/`; it is the
  single source of truth for protocol names, payload guards and the version.

See `docs/pdf-reader-architecture.md` for feature placement and validation.
