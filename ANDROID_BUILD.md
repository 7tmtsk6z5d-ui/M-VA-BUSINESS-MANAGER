# MŌVA 4.2 Android Build

The Android project packages the exact root web files under `app/src/main/assets/web/`.

Package: `id.mova.business`
Target SDK: 36
Version: 4.2.1 / versionCode 421

Build with an Android SDK + Gradle environment. The package does not include a release keystore.

The release APK/AAB must be signed with your own keystore before distribution.

Google Login uses the native external-browser flow and returns to `mova://auth/callback`.
