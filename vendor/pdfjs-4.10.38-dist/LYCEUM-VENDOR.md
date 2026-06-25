# Mozilla PDF.js viewer vendor

Source: `https://github.com/mozilla/pdf.js/releases/download/v4.10.38/pdfjs-4.10.38-dist.zip`

This directory stores the upstream Mozilla PDF.js generic viewer distribution
used by Lyceum's `pdfjs` renderer. Keep this tree as close to the upstream
release as possible.

Lyceum-specific integration files live in `resources/pdfjs-viewer` and are
copied into `public/pdfjs/lyceum` by `scripts/prepare-pdfjs.mjs`.

When updating PDF.js:

1. Replace this directory with the matching upstream `pdfjs-*-dist.zip`.
2. Update `pdfjsVersion` in `scripts/prepare-pdfjs.mjs`.
3. Update `pdfjs-dist` in `package.json` and `package-lock.json` to the same version.
4. Run `node scripts/prepare-pdfjs.mjs`, `npm run test:run -- src/test/pdfRenderer.test.ts`, and `npm run build`.
