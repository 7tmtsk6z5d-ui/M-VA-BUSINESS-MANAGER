# MŌVA 4.2 Final Architecture

## Core decision
The active UI uses one classic `app.js` and one small public `config.js`. No ES-module chain is required for the app shell.

## Runtime contract
1. UI/navigation mounts before cloud initialization.
2. Supabase JS is loaded from a pinned 2.117.2 UMD build.
3. Startup probes the Supabase Auth API before login is offered.
4. No service worker.
5. Internet is mandatory for cloud business data.
6. Browser localStorage contains only non-secret device/theme/auth support data.
7. Financial writes use database RPCs for atomic transaction, stock, expense, closing, reconciliation and restore operations.
8. Realtime is advisory only; direct reads remain authoritative.
9. Payment terminal, Google Play billing and account deletion remain native/server gates.
10. Android embeds the exact same web build under `android/app/src/main/assets/web/`.

## Auth
- Email/password signup and login.
- Google OAuth with Supabase PKCE.
- Android native shell returns through `mova://auth/callback`.
- Web/PWA uses the current HTTPS origin.
- Local `file://` mode does not invent a Google OAuth callback URL.

## Data recovery
Backup exports business-scoped data without the Supabase API key. Restore is owner-only and executed by the `mova_restore_backup` SECURITY DEFINER RPC so protected financial tables are not written directly by the client.
