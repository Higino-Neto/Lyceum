# Lyceum Mobile release

The mobile app has two update tracks:

- web bundle OTA through `@capgo/capacitor-updater`;
- native Android APK updates through the in-app `AppUpdater` Capacitor plugin.

## GitHub OTA

On native Android/iOS startup the app queries the GitHub Releases API and finds
the newest non-draft release tagged `mobile-v*` that contains:

```text
lyceum-mobile-ota.json
```

If the manifest version is newer than the installed web bundle, the app downloads the matching `lyceum-mobile-ota-<version>.zip` from the same GitHub Release and schedules it for the next background/restart.

OTA updates are only for the Capacitor web bundle: HTML, CSS, JavaScript, and bundled web assets. Native changes, including Capacitor plugin changes, Android Gradle changes, iOS project changes, permissions, entitlements, and app icons still require shipping a new native build.

## Android APK updater

On Android startup and from the mobile profile screen, the app discovers this
asset in the newest matching `mobile-v*` release:

```text
lyceum-mobile-latest.json
```

The URL can be overridden at build time with:

```env
VITE_MOBILE_APK_UPDATE_MANIFEST_URL
```

The manifest shape is:

```json
{
  "version": "1.8.13",
  "versionCode": 10813,
  "apkUrl": "https://github.com/Higino-Neto/Lyceum/releases/download/mobile-v1.8.13/lyceum-mobile-1.8.13.apk",
  "sha256": "...",
  "sizeBytes": 12345678,
  "notes": "Lyceum Mobile 1.8.13",
  "publishedAt": "2026-06-25T12:00:00.000Z",
  "minSdk": 24,
  "mandatory": false
}
```

The app compares `versionCode`, requires and validates SHA-256 and the exact file
size, validates the package name, minimum Android SDK, higher version code, and
signing certificate against the installed app, then opens the Android system
installer through a cache-scoped `FileProvider`. Android still requires the user
to confirm the installation. On Android 8+, the user may also need to allow
Lyceum to install unknown apps.

Native APK updates require every release APK to use:

- the same `applicationId`: `com.higino.lyceum.mobile`;
- a higher `versionCode`;
- the same signing key as the APK currently installed on the device.

## Android signing secrets

The `Mobile Release` workflow no longer generates a temporary release keystore. Configure these GitHub Secrets before publishing APK updates:

```env
ANDROID_KEYSTORE_BASE64
ANDROID_SIGNING_STORE_PASSWORD
ANDROID_SIGNING_KEY_ALIAS
ANDROID_SIGNING_KEY_PASSWORD
```

The workflow also requires `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as repository variables or secrets. Publishing stops
instead of producing an APK with a non-functional account screen when either is
missing. Set `VITE_AUTH_REDIRECT_BASE_URL` as well so password-recovery emails
return to the configured Lyceum reset-password page.

Create the keystore once, keep it backed up, and store its base64 form in `ANDROID_KEYSTORE_BASE64`. Losing or changing this keystore prevents Android from updating the installed app in place.

## Publish

Run the `Mobile Release` GitHub Actions workflow with the desired version. It:

- builds `dist-mobile`;
- runs the mobile regression test suite and TypeScript validation;
- creates the Capgo-compatible OTA zip and manifest;
- builds the signed Android release APK with the configured release keystore;
- creates `lyceum-mobile-latest.json` for native APK updates;
- publishes the OTA manifest, OTA zip, APK manifest, and APKs to a GitHub Release tagged `mobile-v<version>`;
- verifies the iOS project on macOS without code signing; this check is required,
  rather than allowed to fail silently.

## iOS signing

GitHub cannot distribute a usable iOS app without Apple signing. To publish a real `.ipa`, add Apple Developer signing secrets and extend the `ios-native-check` job to archive/export with the provisioning profile, or ship via TestFlight/App Store.
