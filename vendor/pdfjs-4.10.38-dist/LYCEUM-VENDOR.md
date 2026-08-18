# Mozilla PDF.js viewer vendor

Source: `https://github.com/mozilla/pdf.js/releases/download/v4.10.38/pdfjs-4.10.38-dist.zip`

This directory stores the upstream Mozilla PDF.js generic viewer distribution
used by Lyceum's `pdfjs` renderer. Keep this tree as close to the upstream
release as possible. It now acts as an **automatic fallback** for the viewer
built from source (see below).

Lyceum-specific integration files live in `resources/pdfjs-viewer` and are
copied into `public/pdfjs/lyceum` by `scripts/prepare-pdfjs.mjs`.

## Source-based build (preferred)

The official PDF.js 4.10.38 **source** lives in `vendor/pdfjs-4.10.38/`
(a checkout of the `v4.10.38` tag). `scripts/prepare-pdfjs.mjs` prefers the
viewer produced by the official build over this prebuilt dist when it exists:

- Source build output: `vendor/pdfjs-4.10.38/build/generic/{build,web}`
- Fallback: `vendor/pdfjs-4.10.38-dist/{build,web}`

The official build is reproducible from source (no hand-edited bundles):

```bash
cd vendor/pdfjs-4.10.38
npm install --ignore-scripts      # skip native fuzzing prebuilds (not needed to build the viewer)
npx gulp generic                  # outputs build/generic/{build,web}
```

`build/generic` is git-ignored; only the source tree is committed.

## Regenerating Lyceum's viewer assets

After any source change in `vendor/pdfjs-4.10.38/` (or to fall back to the
dist), run from the repo root:

```bash
node scripts/prepare-pdfjs.mjs    # copies build output + Lyceum bridge, patches viewer.html/viewer.mjs
npm run dev                       # runs prepare-pdfjs.mjs, then vite
npm run build                     # runs prepare-pdfjs.mjs, then tsc + vite build
```

When updating PDF.js:

1. Replace this directory with the matching upstream `pdfjs-*-dist.zip` (fallback only).
2. Update `pdfjsVersion` in `scripts/prepare-pdfjs.mjs`.
3. Update `pdfjs-dist` in `package.json` and `package-lock.json` to the same version.
4. Run `node scripts/prepare-pdfjs.mjs`, `npm run test:run -- src/test/pdfRenderer.test.ts`, and `npm run build`.
