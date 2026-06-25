# Lyceum Mobile release

The mobile app has two update tracks:

- web bundle OTA through `@capgo/capacitor-updater`;
- native Android APK updates through the in-app `AppUpdater` Capacitor plugin.

## GitHub OTA

On native Android/iOS startup the app checks:

```text
https://github.com/higino-neto/lyceum/releases/latest/download/lyceum-mobile-ota.json
```

If the manifest version is newer than the installed web bundle, the app downloads the matching `lyceum-mobile-ota-<version>.zip` from the same GitHub Release and schedules it for the next background/restart.

OTA updates are only for the Capacitor web bundle: HTML, CSS, JavaScript, and bundled web assets. Native changes, including Capacitor plugin changes, Android Gradle changes, iOS project changes, permissions, entitlements, and app icons still require shipping a new native build.

## Android APK updater

On Android startup and from the mobile profile screen, the app checks:

```text
https://github.com/Higino-Neto/Lyceum/releases/latest/download/lyceum-mobile-latest.json
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

The app compares `versionCode`, downloads the APK, validates SHA-256 when present, validates that the APK package name still matches `com.higino.lyceum.mobile`, and opens the Android system installer through `FileProvider`. Android still requires the user to confirm the installation. On Android 8+, the user may also need to allow Lyceum to install unknown apps.

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

Create the keystore once, keep it backed up, and store its base64 form in `ANDROID_KEYSTORE_BASE64`. Losing or changing this keystore prevents Android from updating the installed app in place.

## Publish

Run the `Mobile Release` GitHub Actions workflow with the desired version. It:

- builds `dist-mobile`;
- creates the Capgo-compatible OTA zip and manifest;
- builds Android debug/release APKs with the configured release keystore;
- creates `lyceum-mobile-latest.json` for native APK updates;
- publishes the OTA manifest, OTA zip, APK manifest, and APKs to a GitHub Release tagged `mobile-v<version>`;
- verifies the iOS project on macOS without code signing.

## iOS signing

GitHub cannot distribute a usable iOS app without Apple signing. To publish a real `.ipa`, add Apple Developer signing secrets and extend the `ios-native-check` job to archive/export with the provisioning profile, or ship via TestFlight/App Store.
