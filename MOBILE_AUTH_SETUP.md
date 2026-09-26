# MŌVA 4.2 Mobile Auth Setup

## Supabase Auth
Enable Email/Password and Google under the project's Authentication provider settings.

For Android, allow the exact redirect:

`mova://auth/callback`

For the web/PWA build, use the production HTTPS origin.

## Google Cloud
Create the Google OAuth client for the Supabase Google provider and use the Supabase callback URI shown by the project/provider configuration. The app contains no Google client secret.

## Android
Google authentication opens in the device browser. After authorization, the browser returns to `mova://auth/callback`; the Android shell forwards that URI to the WebView, which completes the Supabase PKCE exchange.

## iPhone / iPad
The web/PWA build uses the current HTTPS origin callback. A later native iOS shell can register a native deep/universal link while reusing the same PKCE callback logic.

## Publishable key
The client uses a Supabase `sb_publishable_…` key. Supabase documents publishable keys for browser/mobile clients; secret/service-role keys must remain server-side.
