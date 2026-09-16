# Release guide

Lyceum has one global product version. `package.json` is the source of truth, and every stable release uses the matching Git tag and GitHub Release:

```text
package.json  1.9.0
Git tag       v1.9.0
Release       Lyceum 1.9.0
```

The only release publisher is `.github/workflows/main.yml`. It runs for `v*` tags or by manual dispatch with an existing `vX.Y.Z` tag. A push to `main` never publishes a product release.

## Publish a stable version

1. Run the tests and smoke checks.
2. Update both `package.json` and `package-lock.json` with `npm version 1.9.0 --no-git-tag-version`.
3. Commit the version bump and push it to `main`.
4. Create the matching tag with `git tag v1.9.0` and push it with `git push origin v1.9.0`.
5. Watch the `Release` workflow. Do not create a separate desktop, mobile, or Legacy tag.

The validation job rejects prerelease-shaped or mismatched tags. Android `versionName` is the package version. Its independent integer required by Android is deterministically encoded as `major * 1,000,000 + minor * 1,000 + patch` and Gradle rejects overrides that do not match.

## Build and publication architecture

After validation, Windows, Linux, Android, and Windows Legacy build in parallel. Each job uploads private GitHub Actions artifacts and has no permission or token to publish a Release. The final job runs only after every required job succeeds; it flattens the files, rejects duplicate/empty/wrong-version assets, checks the required filenames and mobile manifests, and generates `SHA256SUMS.txt`.

The publisher creates a draft, uploads the complete validated set, checks the remote asset count, and only then makes it public and marks it Latest. If any step fails, the Release remains a draft and `/releases/latest` is unchanged.

Release notes combine a deterministic platform/download guide from `scripts/release/generate-notes.mjs` with GitHub's generated changelog.

## Desktop updater

Modern Windows x64 consumes `latest.yml`, Windows ARM64 consumes `latest-arm64.yml`, and Linux consumes `latest-linux.yml`. The resolver only accepts stable `vX.Y.Z` releases that contain both the platform metadata and an installable package. Android manifests coexist in the same Release and do not participate in Electron update resolution.

The Windows Legacy build has automatic updates disabled. This prevents Electron 22 on Windows 7/8/8.1 from consuming `latest.yml` and installing the incompatible Windows 10/11 package. Legacy users download a new Legacy installer from the current global Release.

## Windows Legacy compatibility

There is no permanent Legacy branch. `electron-builder.legacy.json5` uses the same application source with Electron 22.3.27, marks the packaged flavor as `legacy`, and produces `Lyceum-<version>-Windows-Legacy-x64-Setup.exe`.

Electron 22 embeds Node 16, while the main dependency lines of `better-sqlite3`, `sharp`, `chokidar`, and `tar` require newer Node versions. The Legacy job therefore installs fixed, API-compatible Node 16 lines before Electron Builder rebuilds native modules against Electron 22's ABI. Changes to main/preload code or these dependencies must be smoke-tested on a real Windows 7/8/8.1 machine. Electron 22 is end-of-life and does not receive current Electron/Chromium security fixes.

The Legacy bundle explicitly targets Chromium 108 and Node 16.17. Its protocol implementation uses the Electron 22 `registerStreamProtocol` API rather than APIs added in Electron 25. After packaging, CI installs the generated NSIS package in a temporary directory and starts it with `--lyceum-smoke-test`; this creates and migrates SQLite, loads `sharp` and `@napi-rs/canvas`, starts the processing worker, parses a real PDF, and must write a passing report before the installer is accepted.

The same check is the release certification command on a clean Windows 7 SP1 x64 machine:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\release\test-windows-legacy.ps1 -Installer ".\Lyceum-1.8.28-Windows-Legacy-x64-Setup.exe"
```

A Legacy installer is supportable only after this command passes on Windows 7 itself. The hosted GitHub runner proves packaging and startup on current Windows, but it is not a substitute for the Windows 7 certification run.

Both desktop flavors retain `contextIsolation: true`, `nodeIntegration: false`, sandboxing, denied popup windows, and navigation restrictions from the shared application code.

## Secrets and signing

`VITE_SUPABASE_URL` and the public Supabase anon key are injected into client builds. Never store a service-role key, AWS secret, JWT signing secret, keystore, certificate private key, or signing password in the repository or client bundle.

Android signing uses these GitHub Secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_SIGNING_STORE_PASSWORD
ANDROID_SIGNING_KEY_ALIAS
ANDROID_SIGNING_KEY_PASSWORD
```

Losing or changing the Android signing key prevents in-place updates. Windows/macOS signing can be added later through repository secrets without changing the global release model; macOS is not currently an official CI target.

## Local checks

```bash
node scripts/release/validate-version.mjs v1.9.0
npm run test:run
npm run build
npm run dist:linux
```

Local packages are written below `release/<version>/`. Electron Builder must always run with `--publish never` outside the final GitHub Actions publisher.
