# Lyceum PDF.js integration

The Mozilla PDF.js viewer itself is vendored in `vendor/pdfjs-4.10.38-dist`.
Files in this directory are Lyceum-specific runtime overlays copied into
`public/pdfjs/lyceum` by `scripts/prepare-pdfjs.mjs`.

Keep the vendored viewer as close to the upstream release as possible. Put
Electron protocol, reading-state, and visual integration code here instead.
