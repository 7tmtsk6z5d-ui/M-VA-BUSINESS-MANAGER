# MŌVA 4.2 — Google Play Release Checklist

## App identity
- Package: `id.mova.business`
- Version name: `4.2.1`
- Version code: `420`
- Brand: MŌVA
- Label: `KASIR · KEUANGAN · STOK`

## Android build
- compileSdk 36
- targetSdk 36
- minSdk 26
- AGP 8.13.2 project
- Google Play Billing 9.1.0
- Release signing key configured outside source control
- Produce a signed AAB/APK with a real Android SDK + Gradle toolchain

## Functional QA
- Fresh install opens the app shell.
- Email/password signup and login succeed against the target Supabase project.
- Google login completes through the external browser and returns to `mova://auth/callback`.
- Auth session survives app restart.
- Product CRUD is business-scoped.
- Checkout never writes a negative stock balance.
- Cancellation restores stock exactly once.
- Cash change calculation is correct.
- QRIS is recorded as a payment method and is not treated as provider verification.
- Daily closing and cash reconciliation are idempotent per business/date.
- Backup export does not contain the Supabase API key.
- Restore is owner-only and uses `mova_restore_backup`.
- Business A cannot read Business B data.
- Viewer cannot mutate owner-only data.
- Cashier cannot modify owner-only catalog/settings.

## Payment Terminal QA
- Notification access is explicitly enabled by the user.
- Only explicitly allowed payment-app package names are parsed.
- Refund/outgoing notifications are ignored.
- Duplicate notification events are de-duplicated.
- Only one active payment-terminal device exists per business.
- TTS activates only for an enabled terminal with Pro entitlement.

## Subscription QA
- Play products exist: `mova_pro_monthly`, `mova_pro_yearly`.
- Purchase entitlement is verified server-side before Pro activation.
- Purchase acknowledgement happens after verification.
- Cancellation/grace/expiration states are reflected server-side.

## Privacy / Play policy
- Privacy policy URL is live.
- Account/data deletion flow is tested.
- Data Safety declaration matches the exact shipped build/backend.
- Notification access purpose is disclosed clearly.
- No Supabase secret/service-role key or Google client secret is embedded.

## Cloud release
1. Run `SUPABASE_MOVA_FINAL_RESET.sql`.
2. Run `SUPABASE_MOVA_FINAL_PREFLIGHT.sql`.
3. Enable Email/Password and Google Auth providers.
4. Add the production HTTPS callback and `mova://auth/callback` to Supabase Auth Redirect URLs as required.
5. Configure the Google OAuth client using the callback supplied by Supabase.
6. Deploy required server-side functions/secrets used by the production entitlement/deletion workflow.
7. Test with at least two separate business accounts.
