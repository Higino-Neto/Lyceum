# Android release and updates

Android is part of the global Lyceum release. Future releases use `vX.Y.Z`; historical `mobile-v*` releases remain untouched but are ignored by current update discovery.

The release workflow builds two signed APKs from the same commit and product version:

```text
Lyceum-<version>-Android-arm64.apk
Lyceum-<version>-Android-universal.apk
```

`package.json` supplies Android `versionName`. Gradle and the release validator derive the required monotonically increasing `versionCode` from the same SemVer, so a mobile-only fix still requires a global patch bump.

## Update assets

The global GitHub Release also contains:

```text
lyceum-mobile-ota.json
Lyceum-<version>-Android-OTA.zip
lyceum-mobile-latest.json
```

The OTA path updates only the Capacitor HTML/CSS/JavaScript bundle. Native plugin, Gradle, permission, and icon changes require an APK. The native updater uses the universal APK, validates its HTTPS URL, exact size and SHA-256, then verifies package identity, minimum SDK and signing certificate before opening Android's system installer.

The app searches only stable global `vX.Y.Z` releases for these manifests. It no longer searches or publishes `mobile-v*` releases, so Android can never replace the product's Latest release independently.

## Signing

Release APKs must retain application ID `com.higino.lyceum.mobile`, a higher `versionCode`, and the same signing key as the installed app. The key and passwords live only in GitHub Secrets; the workflow fails before building if any required signing value is missing.

Android 7.0 (API 24) is the current minimum. Android requires the user to confirm APK installation, and Android 8+ may require permission to install unknown apps.
