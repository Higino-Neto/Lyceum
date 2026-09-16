# Desktop PDF reader architecture

## Data flow

1. Electron opens or reopens a document, verifies its hash, registers its path,
   and returns metadata for PDFs. EPUBs still return their bytes.
2. React opens `lyceum-pdfjs://viewer/web/viewer.html` in an iframe. The viewer
   loads the PDF from `lyceum-pdf://document/<sha256>.pdf`; the Electron
   protocol handles range requests and streams whole-file responses.
3. `resources/pdfjs-viewer/lyceum-bridge.mjs` adapts PDF.js to Lyceum.
   `lyceum-messaging.mjs` owns cross-frame transport; the matching typed parser
   is `src/pages/ReadingPage/components/pdf-reader/pdfBridgeProtocol.ts`.
   Messages carry protocol version 1. `document-ready` starts state restore
   and outline loading; `state-changed` drives page display and persistence.
4. Electron's native viewer handlers call only `LyceumPdfJs` operations in the
   iframe. They do not reimplement PDF.js navigation or outline extraction.

## Where new features go

| Change | Primary location |
| --- | --- |
| Reader UI, controls, concepts, study tools | React components and the bridge overlay |
| Frame messages | Both protocol modules; increment the protocol version for breaking changes |
| File access, OS integration, export | Electron services and a narrow preload API |
| PDF.js viewer internals unavailable through the overlay | `vendor/pdfjs-4.10.38/web/`, with a documented isolated patch |
| Rendering, extraction, parsing | Vendored `src/display/` or `src/core/`, plus upstream tests |
| Persisted annotations or locators | Explicit format version and migration before release |

Do not edit generated `public/pdfjs/` or a compiled `viewer.mjs`. Keep
`pdfjs-dist` pinned to the same release as the vendored source; its mobile,
thumbnail and conversion consumers must be checked during any upgrade.

## Foundation checklist

- [x] Build the generic viewer from one tracked source in development and CI.
- [x] Remove the unused prebuilt vendor distribution.
- [x] Pin `pdfjs-dist` to the matching release.
- [x] Fail when viewer HTML integration points move.
- [x] Use a versioned frame transport and validate incoming messages.
- [x] Remove duplicate PDF.js logic from Electron handlers.
- [x] Load outline and restore state after document readiness instead of polling.
- [x] Serve normal PDFs by path/range without requiring a React ArrayBuffer.
- [x] Bound remaining byte caches and stream non-range file responses.
- [x] Add contract and cache regression tests.
- [x] Add an Electron smoke test that checks a real browser PDF.js worker.
- [ ] Run the packaged reader smoke test on Windows and Linux before release.

## Release checks for reader changes

Run `npm run test:run`, `npm run build`, `npm run test:pdf:electron`, and
`npm run build:mobile`. Open a
packaged app on both desktop platforms with a normal text PDF, a scanned PDF,
a rotated/mixed-size PDF, and a large PDF. Check first-page rendering, worker
loading, selection, concepts, outline, navigation, state restoration after
restart, search, and page count. Measure time to first page and peak memory
against the previous release. If vendor core/display changed, also run PDF.js
unit, integration and reference tests relevant to the patch. Keep version
upgrades separate from feature work so regressions have a clear cause.
