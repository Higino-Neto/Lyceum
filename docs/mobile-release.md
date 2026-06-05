# Lyceum Mobile release

The mobile app uses `@capgo/capacitor-updater` in manual self-hosted mode.

## GitHub OTA

On native Android/iOS startup the app checks:

```text
https://github.com/higino-neto/lyceum/releases/latest/download/lyceum-mobile-ota.json
```

If the manifest version is newer than the installed web bundle, the app downloads the matching `lyceum-mobile-ota-<version>.zip` from the same GitHub Release and schedules it for the next background/restart.

OTA updates are only for the Capacitor web bundle: HTML, CSS, JavaScript, and bundled web assets. Native changes, including Capacitor plugin changes, Android Gradle changes, iOS project changes, permissions, entitlements, and app icons still require shipping a new native build.

## Publish

Run the `Mobile Release` GitHub Actions workflow with the desired version. It:

- builds `dist-mobile`;
- creates the Capgo-compatible OTA zip and manifest;
- builds Android debug/release APKs;
- publishes the OTA manifest, OTA zip, and APKs to a GitHub Release tagged `mobile-v<version>`;
- verifies the iOS project on macOS without code signing.

## iOS signing

GitHub cannot distribute a usable iOS app without Apple signing. To publish a real `.ipa`, add Apple Developer signing secrets and extend the `ios-native-check` job to archive/export with the provisioning profile, or ship via TestFlight/App Store.
