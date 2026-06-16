# Release Guide

Lyceum uses Electron Builder and GitHub Actions for releases.

## Local Release Build

```bash
npm run build
npm run dist
```

Generated packages are written under `release/`.

## GitHub Release Workflow

The release workflow is `.github/workflows/main.yml`.

On pushes to `main`, it:

1. Checks out the repository.
2. Installs Node.js 20.
3. Runs `npm install`.
4. Runs `npm run build`.
5. Runs Electron Builder with GitHub publishing.

The workflow uses `GITHUB_TOKEN` through the `GH_TOKEN` environment variable.
It also requires these GitHub repository variables or secrets before publishing:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Vite embeds those values into the renderer bundle at build time. If they are missing,
the workflow fails before Electron Builder publishes an installer.

## Versioning

The app version is read from `package.json`.

Before a public release:

1. Update `package.json`.
2. Build locally.
3. Smoke test the reader, library sync, dashboard, and sign-in.
4. Push to `main` when ready to publish.

## Documentation Publishing

Documentation is published by `.github/workflows/docs.yml`.

To enable it:

1. Open repository Settings.
2. Open Pages.
3. Select GitHub Actions as the Pages source.
4. Push changes to `docs/` on `main`.
