# MŌVA 4.2.1

## Auth / Cloud
- Supabase JS pinned to 2.117.2.
- Public runtime configuration isolated in `config.js`.
- Startup API probe reports invalid/mismatched publishable keys explicitly.
- Google OAuth and password-reset callbacks refuse unusable `file://` redirects outside the native APK.
- Auth state refresh is deferred outside `onAuthStateChange` callback execution.

## Data integrity
- Backup now includes brands/categories and excludes the Supabase API key from exported JSON.
- Restore now uses `mova_restore_backup(...)` as an owner-only atomic database operation.
- Restore validates the target business and prevents cross-business ID updates.
- Backup now paginates cloud data instead of stopping at a fixed 5,000-row cap.
- Daily transaction history exposes safe cancellation for non-viewer roles, using the existing stock-restoring RPC.

## Android
- Version 4.2.1 / versionCode 421.
- Native Google OAuth callback remains `mova://auth/callback`.
- Payment Terminal role is registered in Supabase when configured from the Android shell.
- Google Play subscription purchases are acknowledged by the native layer after receipt; entitlement remains server-verification controlled.

## Verification
- JavaScript syntax checked with Node.
- Root web files mirrored into Android assets and byte-compared.
- No Supabase secret/service-role key is included in the client.
