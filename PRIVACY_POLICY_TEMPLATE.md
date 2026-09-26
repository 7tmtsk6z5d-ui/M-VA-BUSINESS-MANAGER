# MŌVA — Privacy Policy Template

**Last updated:** [FILL DATE]

MŌVA Business Manager is an internet-connected business management application for recording sales, inventory, expenses, reports, backups, team access, and cloud synchronization.

## Data MŌVA can process
- Business records: products, prices/HPP, stock movements, sales, transaction items, expenses, customers, cash reconciliation, daily closing, audit records, and business settings.
- Account data when cloud is enabled: email/account identifier and business membership/role.
- Device data needed for the app: a locally generated device identifier, app version, and optional payment-terminal role.
- Payment notification data only when the user explicitly enables Android notification access: payment amount, provider label, reference when available, timestamp, and a normalized event fingerprint. MŌVA does not read another app's private database.
- Optional media: product/business images uploaded only when the user enables MŌVA Pro Cloud Media.

## Why the data is processed
MŌVA uses this information to provide POS, inventory, financial reporting, backup/restore, cloud synchronization, team roles, payment-event reconciliation, and subscription entitlement management.

## Internet requirement
An internet connection is required for normal MŌVA operation. Business records are read from and written to the configured cloud database; local browser storage is limited to device preference data such as theme and a generated device key.

## Cloud and third-party services
When enabled, MŌVA may use Supabase for authentication, database storage, realtime updates, and media storage. MŌVA Pro subscriptions use Google Play Billing and server-side verification. Payment-provider webhook integrations are only enabled when the business configures a supported provider.

## Notification access
The payment-terminal feature requires the user to explicitly grant Android notification access. The application should only receive notifications from package names the user has explicitly allowed. The feature must be disabled when the user revokes notification access or the terminal role is removed.

## Security
Sensitive server credentials are kept server-side. Client applications use only publishable Supabase credentials. Local sensitive values such as PIN state and selected device credentials are protected using platform/device storage where supported.

## Retention and deletion
Business owners can remove their account/data according to the MŌVA account and deletion workflow. Financial records are not silently rewritten or deleted to hide history; cancellation/void actions retain an auditable state.

## Contact
**Data/privacy contact:** [FILL EMAIL]
**Business/entity:** [FILL LEGAL ENTITY]

> This template is a product-release starting point, not legal advice. Replace placeholders and have the final policy reviewed for the jurisdictions where MŌVA is distributed.
