# MŌVA Final Release Plan

## Owner actions that cannot be automated from this source package

1. Create or choose a GitHub repository you control and upload this project.
2. In the repository, enable Pages with **GitHub Actions** as the source.
3. Wait for the web workflow and copy the HTTPS Pages URL.
4. Add that URL to Supabase Auth Redirect URLs.
5. Keep `mova://auth/callback` there for Android.
6. Enable Email and Google providers in Supabase.
7. Run the Android workflow and download `mova-4.2.4-debug-apk`.

## After APK build
Install the artifact on Android and test:
- Register with Email/Password.
- Sign in with Email/Password.
- Continue with Google.
- Return through `mova://auth/callback`.
- Logout.
- Sign back in.

## Play Store later
A signed release AAB needs the owner's release keystore and Play Console setup. Those credentials stay outside this repository.
