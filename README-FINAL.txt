MŌVA Business Manager — 4.2.4 FINAL READY

This is the single source-of-truth package.

RUNTIME
- Internet required for business data.
- Supabase project: https://wufjamnqlwrvbxsnvpsa.supabase.co
- Public Supabase key is in config.js.
- Google Client ID is kept separate from the Supabase key.
- Login: Google OAuth + Email/Password + Register + Password Reset.
- Android OAuth callback: mova://auth/callback.

WEB / iPhone / iPad
- GitHub Pages workflow: .github/workflows/web-pages.yml
- HTTPS is required for Google OAuth in the web/PWA build.

ANDROID
- Android project: android/
- APK workflow: .github/workflows/android-apk.yml
- Build uses JDK 17, Gradle 8.13, Android SDK 36.
- Installable output: app-debug.apk.

SUPABASE SQL
Run in this order, once when rebuilding the application schema:
1) SUPABASE_MOVA_FINAL_RESET.sql
2) SUPABASE_MOVA_FINAL_PREFLIGHT.sql
Do not mix old MÖOYA/MŌVA migration files afterwards.

ONE-TIME OWNER ACTIONS
1) Put this folder into a GitHub repository you control.
2) Push the project to the default branch.
3) Enable GitHub Pages using GitHub Actions in repository Settings > Pages.
4) Wait for Web HTTPS workflow; copy its Pages URL.
5) Add the Pages URL to Supabase Authentication > URL Configuration > Redirect URLs.
6) Keep mova://auth/callback in Supabase Redirect URLs for Android.
7) Enable Email/Password and Google in Supabase Authentication providers.
8) In Google Cloud OAuth Client, keep this Authorized Redirect URI:
   https://wufjamnqlwrvbxsnvpsa.supabase.co/auth/v1/callback
9) Run the Android APK workflow manually; download the artifact and install it on Android.

SECRETS
Never put a Supabase secret/service_role key, Google Client Secret, or release keystore into source control.
