# MŌVA 4.2.5 FINAL — TEST REPORT

## Static verification
- JavaScript syntax checked with Node: PASS.
- Root and Android embedded web copies are byte-identical for `index.html`, `app.js`, `config.js`, `styles.css`, and `manifest.json`.
- Production HTTPS URL is explicitly configured for the GitHub Pages site.
- Android native callback is explicitly configured as `mova://auth/callback`.
- Supabase Project URL and Publishable Key are fixed to the supplied MŌVA project pair.
- Google Client ID remains separate from the Supabase Publishable Key.
- No Supabase secret/service-role key or Google Client Secret is bundled.

## Auth
- Email/password login and registration are retained.
- Google OAuth uses Supabase PKCE.
- HTTPS web login redirects to the fixed MŌVA GitHub Pages URL.
- Android native login redirects back through `mova://auth/callback`.
- OAuth code exchange uses `exchangeCodeForSession` in the same WebView session that initiated PKCE.
- Raw SPCK `file://` mode intentionally does not attempt Google OAuth.

## Build
- Android project remains included with package `id.mova.business` and version 4.2.5 / versionCode 425.
- GitHub Actions workflow is included to build an installable debug APK.
- This ZIP is source/project code, not a signed APK.
