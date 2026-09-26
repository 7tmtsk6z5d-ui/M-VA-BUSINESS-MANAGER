-- MŌVA FINAL — preflight / verification
-- Run AFTER SUPABASE_MOVA_FINAL_RESET.sql.

select 'TABLE' as check_type, table_name as object_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'businesses','business_members','device_registry','brands','categories','products',
    'transactions','transaction_items','stock_movements','customers','expenses',
    'business_settings','audit_logs','daily_closings','cash_reconciliations',
    'subscriptions','payment_events'
  )
order by object_name;

select 'RLS' as check_type, tablename as object_name, rowsecurity::text as value
from pg_tables
where schemaname='public'
  and tablename in (
    'businesses','business_members','device_registry','brands','categories','products',
    'transactions','transaction_items','stock_movements','customers','expenses',
    'business_settings','audit_logs','daily_closings','cash_reconciliations',
    'subscriptions','payment_events'
  )
order by object_name;

select 'INDEX' as check_type, indexname as object_name
from pg_indexes
where schemaname='public'
  and indexname in (
    'products_business_sku_unique',
    'idx_transactions_business_date',
    'idx_stock_movements_business',
    'idx_expenses_business_date',
    'payment_events_business_provider_hash_unique'
  )
order by object_name;

select 'FUNCTION' as check_type, routine_name as object_name
from information_schema.routines
where routine_schema='public'
  and routine_name in (
    'ensure_my_business','list_my_businesses','register_my_device',
    'mova_create_transaction','mova_cancel_transaction','mova_add_expense',
    'mova_close_day','mova_reconcile_cash','mova_restore_backup'
  )
order by object_name;

select 'AUTH USERS' as check_type, count(*)::text as value
from auth.users;

select 'BUSINESS ROWS' as check_type, count(*)::text as value
from public.businesses;

select 'PRODUCT ROWS' as check_type, count(*)::text as value
from public.products;

select 'TRANSACTION ROWS' as check_type, count(*)::text as value
from public.transactions;
