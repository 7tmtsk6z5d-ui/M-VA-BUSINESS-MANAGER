# Rename the existing Supabase project to MŌVA

We are keeping the **same Supabase project**. No new project is required.

## 1. Rename the project in Supabase Dashboard

Open the existing project (the one whose project ref is currently used by MŌVA) and change its human-readable project name to:

**MŌVA**

The current Supabase project ref/API URL remains the identifier used by the app. Supabase gives each project a unique API URL, and the app continues using the existing project URL and publishable key.

## 2. Do not change these in the app

Current project URL:

`https://wufjamnqlwrvbxsnvpsa.supabase.co`

Current client key remains the existing **publishable** key already in `config.js`.

Do not replace it with a `service_role` or secret key.

## 3. Reset the SQL schema

In Supabase → SQL Editor, run:

`SUPABASE_MOVA_FINAL_RESET.sql`

This resets the MŌVA application database structure while preserving `auth.users`.

Then run:

`SUPABASE_MOVA_FINAL_PREFLIGHT.sql`

## 4. Auth

Enable Email/Password in Supabase Authentication.

After that, use MŌVA:

Register → Login → automatic first business creation → Product → Checkout → Finance.

## 5. Storage

The SQL keeps the `mova-media` bucket and its existing files. It does not delete old storage objects automatically.

## 6. Important

Do not run the old `SUPABASE_FINAL_INSTALL.sql`, `SUPABASE_FINAL_V2.sql`, V4/V5/V6 migrations, or old `sync_meta` migrations after this reset.

The current MŌVA FINAL REBUILD is **internet-only** and does not need the old offline sync schema.
