# MŌVA 4.2 FINAL — TEST REPORT

Date: 2026-09-26

## Static verification
- `node --check app.js` PASS.
- `node --check config.js` PASS.
- Root `index.html`, `app.js`, and `config.js` match the Android embedded web copies byte-for-byte.
- Supabase runtime config uses the public `sb_publishable_…` key format only.
- No service-role/secret key is embedded in client assets.
- Android package ID is `id.mova.business`.
- Android version is 4.2.1 / versionCode 421.
- Native callback is `mova://auth/callback`.

## Auth hardening
- Supabase JS is pinned to 2.117.2.
- Startup calls the Supabase Auth settings endpoint with the publishable key so an invalid/mismatched key is surfaced before signup/login.
- Login errors are normalized into actionable messages.
- Supabase auth-state refresh is deferred out of the `onAuthStateChange` callback.
- Google and password-reset redirect URLs are refused in raw local `file://` mode unless the native Android bridge exists.

## Backup / restore
- Backup includes brands and categories.
- Backup metadata excludes the Supabase API key.
- Backup retrieval is paginated in 1,000-row pages.
- Home transaction history exposes cancellation for non-viewer roles and routes through the protected cancellation RPC.
- Restore calls `mova_restore_backup(uuid,jsonb,text)`.
- Restore is owner-only, business-scoped, atomic, and guarded against cross-business ID updates.

## Android
- `MainActivity` handles the `mova://auth/callback` deep link.
- Google authentication is opened in the external browser rather than inside the WebView.
- Payment Terminal device-role registration is sent to Supabase after native configuration.
- Google Play Billing uses the current PBL 9 API and refreshes active subscriptions on Android resume; purchase acknowledgements are forwarded to the native layer.

## Live environment limits
A true production login test still requires the target Supabase project to be reachable and configured with Email/Password + Google, with the correct Auth Redirect URLs. The Android project could not be compiled in this container because an Android Gradle/SDK toolchain is not installed here; the ZIP therefore contains the complete source project, not a signed APK.
