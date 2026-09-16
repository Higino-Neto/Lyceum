# Lyceum PDF.js integration

The Mozilla PDF.js source is vendored in `vendor/pdfjs-4.10.38`.
Files in this directory are Lyceum-specific runtime overlays copied into
`public/pdfjs/lyceum` by `scripts/prepare-pdfjs.mjs`.

The viewer is built from source on every prepare/build. Keep upstream changes
small and documented; put Lyceum protocol, reading-state, and visual integration
code here. `lyceum-messaging.mjs` owns the frame protocol. See
`docs/pdf-reader-architecture.md` for feature placement and validation.
