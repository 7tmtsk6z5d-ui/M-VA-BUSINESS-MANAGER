-- ============================================================
-- MŌVA — SUPABASE FINAL DATABASE RESET / REBUILD
-- Project: existing Supabase project formerly named "MÖOYA"
--
-- IMPORTANT
-- 1) This script intentionally resets ONLY MŌVA application tables,
--    functions, policies and triggers in public schema.
-- 2) Supabase Auth users (auth.users) are NOT deleted.
-- 3) Storage objects are NOT deleted automatically.
-- 4) Run this ONCE in Supabase SQL Editor when the existing project
--    contains only MŌOYA/MŌVA development/test data.
-- 5) After it finishes, refresh the schema cache and test:
--    Register/Login -> Business -> Product -> Checkout -> Finance.
--
-- The current MŌVA FINAL REBUILD is internet-only. There is no
-- offline sync_meta layer in this schema.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 0) Remove obsolete policies first (some policies depend on
--    helper functions, so functions must be dropped afterwards).
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname in ('public','storage')
      and (
        tablename in (
          'brands','categories','products','stock_movements','transactions',
          'transaction_items','expenses','customers','business_settings',
          'audit_logs','daily_closings','cash_reconciliations','sync_meta',
          'businesses','business_members','device_registry','subscriptions',
          'payment_events'
        )
        or (schemaname='storage' and tablename='objects')
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 1) Remove obsolete MŌOYA/MŌVA application functions.
-- ------------------------------------------------------------
drop function if exists public.mova_create_transaction(uuid,text,text,numeric,jsonb,uuid,text,text,text);
drop function if exists public.mova_cancel_transaction(uuid,uuid,text);
drop function if exists public.mova_add_expense(uuid,text,text,numeric,text,date,text);
drop function if exists public.mova_close_day(uuid,date,jsonb,text);
drop function if exists public.mova_reconcile_cash(uuid,date,numeric,numeric,text);
drop function if exists public.mova_restore_backup(uuid,jsonb,text);
drop function if exists public.ensure_my_business(text);
drop function if exists public.create_my_business(text);
drop function if exists public.list_my_businesses();
drop function if exists public.my_business_context();
drop function if exists public.register_my_device(uuid,text,text,text,text);
drop function if exists public.set_my_device_role(uuid,text,text);
drop function if exists public.has_business_role(uuid,text[]);
drop function if exists public.is_business_member(uuid);
drop function if exists public.validate_mova_business_links();
drop function if exists public.protect_business_plan();
drop function if exists public.handle_updated_at();

-- ------------------------------------------------------------
-- 2) Drop application tables. Auth remains intact.
-- ------------------------------------------------------------
drop table if exists public.payment_events cascade;
drop table if exists public.subscriptions cascade;
drop table if exists public.device_registry cascade;
drop table if exists public.business_members cascade;
drop table if exists public.businesses cascade;

drop table if exists public.cash_reconciliations cascade;
drop table if exists public.daily_closings cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.business_settings cascade;
drop table if exists public.customers cascade;
drop table if exists public.expenses cascade;
drop table if exists public.transaction_items cascade;
drop table if exists public.transactions cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.products cascade;
drop table if exists public.categories cascade;
drop table if exists public.brands cascade;
drop table if exists public.sync_meta cascade;

-- ------------------------------------------------------------
-- 3) Businesses / account tenancy.
-- ------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  plan text not null default 'free' check (plan in ('free','pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_businesses_owner on public.businesses(owner_id);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','cashier','payment_terminal','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index idx_business_members_user on public.business_members(user_id, is_active);

create table public.device_registry (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  device_name text,
  role text not null default 'cashier' check (role in ('owner','cashier','payment_terminal','viewer')),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, device_key)
);

create index idx_device_registry_business on public.device_registry(business_id, is_active);

-- ------------------------------------------------------------
-- 4) Catalog.
-- ------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_brands_business on public.brands(business_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_categories_business on public.categories(business_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  sku text not null,
  unit text not null default 'pcs',
  price numeric(15,2) not null default 0 check (price >= 0),
  hpp numeric(15,2) not null default 0 check (hpp >= 0),
  stock numeric(15,3) not null default 0 check (stock >= 0),
  min_stock numeric(15,3) not null default 0 check (min_stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index products_business_sku_unique
  on public.products(business_id, upper(btrim(sku)))
  where btrim(sku) <> '';
create index idx_products_business on public.products(business_id, is_active);
create index idx_products_name on public.products(business_id, name);

-- ------------------------------------------------------------
-- 5) Transactions / inventory / finance.
-- ------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transaction_number text not null,
  transaction_date timestamptz not null default now(),
  payment_method text not null check (payment_method in ('cash','qris')),
  subtotal numeric(15,2) not null default 0 check (subtotal >= 0),
  discount numeric(15,2) not null default 0 check (discount >= 0),
  total numeric(15,2) not null default 0 check (total >= 0),
  amount_received numeric(15,2) not null default 0 check (amount_received >= 0),
  change_amount numeric(15,2) not null default 0 check (change_amount >= 0),
  total_hpp numeric(15,2) not null default 0 check (total_hpp >= 0),
  total_profit numeric(15,2) not null default 0,
  status text not null default 'completed' check (status in ('completed','cancelled','returned')),
  note text,
  customer_id uuid,
  cashier_name text,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (business_id, transaction_number)
);
create index idx_transactions_business_date on public.transactions(business_id, transaction_date desc);
create index idx_transactions_business_status on public.transactions(business_id, status);
create index idx_transactions_business_payment on public.transactions(business_id, payment_method);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  total_purchase numeric(15,2) not null default 0 check (total_purchase >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_customers_business on public.customers(business_id);
create index idx_customers_name on public.customers(business_id, name);

alter table public.transactions
  add constraint transactions_customer_fk
  foreign key (customer_id) references public.customers(id) on delete set null;

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric(15,3) not null check (quantity > 0),
  unit_price numeric(15,2) not null check (unit_price >= 0),
  unit_hpp numeric(15,2) not null default 0 check (unit_hpp >= 0),
  subtotal numeric(15,2) not null default 0,
  total_hpp numeric(15,2) not null default 0,
  profit numeric(15,2) not null default 0,
  created_at timestamptz not null default now()
);
create index idx_transaction_items_business on public.transaction_items(business_id);
create index idx_transaction_items_transaction on public.transaction_items(transaction_id);
create index idx_transaction_items_product on public.transaction_items(product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  type text not null check (type in ('in','out','sale','return','adjustment','correction')),
  quantity numeric(15,3) not null,
  previous_stock numeric(15,3),
  new_stock numeric(15,3),
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now(),
  created_by text,
  device_id text
);
create index idx_stock_movements_business on public.stock_movements(business_id, created_at desc);
create index idx_stock_movements_product on public.stock_movements(product_id, created_at desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null,
  description text,
  amount numeric(15,2) not null check (amount > 0),
  payment_source text not null check (payment_source in ('cash','qris')),
  expense_date timestamptz not null default now(),
  note text,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_expenses_business_date on public.expenses(business_id, expense_date desc);

create table public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_name text not null default 'MŌVA',
  tagline text not null default 'Fresh Cow''s Milk',
  address text,
  phone text,
  instagram text,
  default_cashier text,
  receipt_footer text not null default 'Terima kasih telah berbelanja.',
  logo_url text,
  pin_hash text,
  pin_salt text,
  pin_enabled boolean not null default false,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  description text,
  device_id text,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_business on public.audit_logs(business_id, created_at desc);

create table public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  closing_date date not null,
  total_omzet numeric(15,2) not null default 0,
  total_hpp numeric(15,2) not null default 0,
  total_gross_profit numeric(15,2) not null default 0,
  total_expense numeric(15,2) not null default 0,
  net_profit numeric(15,2) not null default 0,
  cash_amount numeric(15,2) not null default 0,
  qris_amount numeric(15,2) not null default 0,
  transaction_count integer not null default 0,
  items_sold numeric(15,3) not null default 0,
  note text,
  closed_at timestamptz not null default now(),
  device_id text,
  unique (business_id, closing_date)
);
create index idx_daily_closings_business on public.daily_closings(business_id, closing_date desc);

create table public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reconciliation_date date not null,
  system_cash numeric(15,2) not null,
  physical_cash numeric(15,2) not null,
  difference numeric(15,2) not null,
  status text not null check (status in ('match','shortage','overage')),
  note text,
  created_at timestamptz not null default now(),
  device_id text,
  unique (business_id, reconciliation_date)
);
create index idx_cash_reconciliations_business on public.cash_reconciliations(business_id, reconciliation_date desc);

-- ------------------------------------------------------------
-- 6) MŌVA Pro / Payment Terminal foundation.
-- ------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  status text not null default 'active' check (status in ('active','trialing','grace','expired','cancelled')),
  provider text,
  product_id text,
  external_customer_id text,
  purchase_token_hash text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider, product_id)
);
create index idx_subscriptions_business on public.subscriptions(business_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  reference text,
  amount numeric(15,2) not null check (amount >= 0),
  event_at timestamptz not null default now(),
  verification_status text not null default 'notification_verified' check (verification_status in ('notification_verified','verified','manual','rejected')),
  transaction_id uuid references public.transactions(id) on delete set null,
  raw_hash text,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payment_events_business on public.payment_events(business_id, event_at desc);
create index idx_payment_events_reference on public.payment_events(reference);
create unique index payment_events_business_provider_hash_unique
  on public.payment_events(business_id, provider, raw_hash)
  where raw_hash is not null;

-- ------------------------------------------------------------
-- 7) Updated-at trigger.
-- ------------------------------------------------------------
create function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DO $$
declare t text;
begin
  foreach t in array array['businesses','business_members','device_registry','products','brands','categories','transactions','customers','expenses','business_settings','subscriptions','payment_events'] loop
    execute format('drop trigger if exists trg_updated_at on public.%I', t);
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.handle_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 8) Same-business integrity.
-- ------------------------------------------------------------
create function public.validate_mova_business_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare linked_business uuid;
begin
  if TG_TABLE_NAME='products' then
    if new.brand_id is not null then
      select business_id into linked_business from public.brands where id=new.brand_id;
      if linked_business is distinct from new.business_id then raise exception 'brand_id belongs to another business'; end if;
    end if;
    if new.category_id is not null then
      select business_id into linked_business from public.categories where id=new.category_id;
      if linked_business is distinct from new.business_id then raise exception 'category_id belongs to another business'; end if;
    end if;
  elsif TG_TABLE_NAME='transactions' then
    if new.customer_id is not null then
      select business_id into linked_business from public.customers where id=new.customer_id;
      if linked_business is distinct from new.business_id then raise exception 'customer_id belongs to another business'; end if;
    end if;
  elsif TG_TABLE_NAME='transaction_items' then
    select business_id into linked_business from public.transactions where id=new.transaction_id;
    if linked_business is distinct from new.business_id then raise exception 'transaction_id belongs to another business'; end if;
    select business_id into linked_business from public.products where id=new.product_id;
    if linked_business is distinct from new.business_id then raise exception 'product_id belongs to another business'; end if;
  elsif TG_TABLE_NAME='stock_movements' then
    select business_id into linked_business from public.products where id=new.product_id;
    if linked_business is distinct from new.business_id then raise exception 'stock product belongs to another business'; end if;
  elsif TG_TABLE_NAME='payment_events' then
    if new.transaction_id is not null then
      select business_id into linked_business from public.transactions where id=new.transaction_id;
      if linked_business is distinct from new.business_id then raise exception 'payment transaction belongs to another business'; end if;
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  create trigger trg_products_business_links before insert or update on public.products for each row execute function public.validate_mova_business_links();
  exception when duplicate_object then null;
end $$;
do $$
begin
  create trigger trg_transactions_business_links before insert or update on public.transactions for each row execute function public.validate_mova_business_links();
  exception when duplicate_object then null;
end $$;
do $$
begin
  create trigger trg_transaction_items_business_links before insert or update on public.transaction_items for each row execute function public.validate_mova_business_links();
  exception when duplicate_object then null;
end $$;
do $$
begin
  create trigger trg_stock_movements_business_links before insert or update on public.stock_movements for each row execute function public.validate_mova_business_links();
  exception when duplicate_object then null;
end $$;
do $$
begin
  create trigger trg_payment_events_business_links before insert or update on public.payment_events for each row execute function public.validate_mova_business_links();
  exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 9) Auth / membership helpers.
-- ------------------------------------------------------------
create function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.business_members bm
    where bm.business_id=p_business_id
      and bm.user_id=auth.uid()
      and bm.is_active=true
  );
$$;

grant execute on function public.is_business_member(uuid) to authenticated;

create function public.has_business_role(p_business_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.business_members bm
    where bm.business_id=p_business_id
      and bm.user_id=auth.uid()
      and bm.is_active=true
      and bm.role = any(p_roles)
  );
$$;

grant execute on function public.has_business_role(uuid,text[]) to authenticated;

create function public.my_business_context()
returns table(business_id uuid,business_name text,role text,plan text)
language sql
stable
security definer
set search_path=public
as $$
  select b.id,b.name,bm.role,b.plan
  from public.business_members bm
  join public.businesses b on b.id=bm.business_id
  where bm.user_id=auth.uid() and bm.is_active=true
  order by bm.created_at
  limit 1;
$$;

grant execute on function public.my_business_context() to authenticated;

create function public.ensure_my_business(p_name text default 'MŌVA')
returns table(business_id uuid,business_name text,role text,plan text)
language plpgsql
security definer
set search_path=public
as $$
declare current_business uuid; clean_name text := coalesce(nullif(btrim(coalesce(p_name,'')),''),'MŌVA');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select bm.business_id into current_business
  from public.business_members bm
  where bm.user_id=auth.uid() and bm.is_active=true
  order by bm.created_at
  limit 1;

  if current_business is null then
    insert into public.businesses(owner_id,name,plan)
    values(auth.uid(),clean_name,'free')
    returning id into current_business;

    insert into public.business_members(business_id,user_id,role)
    values(current_business,auth.uid(),'owner');

    insert into public.business_settings(business_id,business_name,tagline)
    values(current_business,clean_name,'Fresh Cow''s Milk');
  else
    insert into public.business_settings(business_id,business_name,tagline)
    values(current_business,clean_name,'Fresh Cow''s Milk')
    on conflict (business_id) do nothing;
  end if;

  return query
  select b.id,b.name,bm.role,b.plan
  from public.business_members bm
  join public.businesses b on b.id=bm.business_id
  where bm.business_id=current_business and bm.user_id=auth.uid() and bm.is_active=true;
end;
$$;

grant execute on function public.ensure_my_business(text) to authenticated;

create function public.list_my_businesses()
returns table(business_id uuid,business_name text,role text,plan text,user_id uuid)
language sql
stable
security definer
set search_path=public
as $$
  select b.id,b.name,bm.role,b.plan,bm.user_id
  from public.business_members bm
  join public.businesses b on b.id=bm.business_id
  where bm.user_id=auth.uid() and bm.is_active=true
  order by bm.created_at;
$$;

grant execute on function public.list_my_businesses() to authenticated;

create function public.create_my_business(p_name text)
returns table(business_id uuid,business_name text,role text,plan text)
language plpgsql
security definer
set search_path=public
as $$
declare row_business uuid; clean_name text := coalesce(nullif(btrim(coalesce(p_name,'')),''),'Bisnis Baru');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1
    from public.business_members bm
    join public.businesses b on b.id=bm.business_id
    where bm.user_id=auth.uid() and bm.is_active=true and b.plan='pro'
  ) then raise exception 'Multi-bisnis tersedia di MŌVA Pro'; end if;

  insert into public.businesses(owner_id,name,plan) values(auth.uid(),clean_name,'free') returning id into row_business;
  insert into public.business_members(business_id,user_id,role) values(row_business,auth.uid(),'owner');
  insert into public.business_settings(business_id,business_name,tagline) values(row_business,clean_name,'Fresh Cow''s Milk');

  return query select b.id,b.name,'owner'::text,b.plan from public.businesses b where b.id=row_business;
end;
$$;

grant execute on function public.create_my_business(text) to authenticated;

create function public.register_my_device(
  p_business_id uuid,
  p_device_key text,
  p_device_name text default null,
  p_role text default 'cashier',
  p_app_version text default null
)
returns public.device_registry
language plpgsql
security definer
set search_path=public
as $$
declare r public.device_registry;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_business_member(p_business_id) then raise exception 'Not a business member'; end if;
  if p_role not in ('owner','cashier','payment_terminal','viewer') then raise exception 'Invalid device role'; end if;
  if p_role='owner' and not public.has_business_role(p_business_id,array['owner']) then raise exception 'Only owner can assign owner device role'; end if;
  if p_role='payment_terminal' and not public.has_business_role(p_business_id,array['owner','cashier','payment_terminal']) then raise exception 'Not allowed to assign payment terminal'; end if;
  if p_role='cashier' and not public.has_business_role(p_business_id,array['owner','cashier','payment_terminal']) then raise exception 'Not allowed to assign cashier device role'; end if;

  if p_role='payment_terminal' then
    update public.device_registry
    set is_active=false, role='cashier', updated_at=now()
    where business_id=p_business_id and device_key<>p_device_key and is_active=true and role='payment_terminal';
  end if;

  insert into public.device_registry(business_id,user_id,device_key,device_name,role,app_version,last_seen_at,updated_at)
  values(p_business_id,auth.uid(),p_device_key,p_device_name,p_role,p_app_version,now(),now())
  on conflict (business_id,device_key) do update set
    user_id=auth.uid(),device_name=excluded.device_name,role=excluded.role,
    app_version=excluded.app_version,is_active=true,last_seen_at=now(),updated_at=now()
  returning * into r;
  return r;
end;
$$;

grant execute on function public.register_my_device(uuid,text,text,text,text) to authenticated;

-- ------------------------------------------------------------
-- 10) Atomic financial RPCs used by the current FINAL REBUILD app.
-- ------------------------------------------------------------
create function public.mova_create_transaction(
  p_business_id uuid,
  p_transaction_number text,
  p_payment_method text,
  p_paid_amount numeric,
  p_items jsonb,
  p_customer_id uuid default null,
  p_cashier_name text default null,
  p_device_id text default null,
  p_note text default null
)
returns public.transactions
language plpgsql
security definer
set search_path=public
as $$
declare
  tx public.transactions;
  item jsonb;
  product_row public.products;
  existing_tx public.transactions;
  total_value numeric(15,2):=0;
  total_hpp_value numeric(15,2):=0;
  item_qty numeric(15,3);
  clean_payment text:=lower(coalesce(p_payment_method,''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_business_role(p_business_id,array['owner','cashier']) then raise exception 'Not allowed'; end if;
  if clean_payment not in ('cash','qris') then raise exception 'Invalid payment method'; end if;
  if nullif(btrim(coalesce(p_transaction_number,'')),'') is null then raise exception 'Transaction number is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;

  select * into existing_tx
  from public.transactions
  where business_id=p_business_id and transaction_number=p_transaction_number
  limit 1;
  if existing_tx.id is not null then return existing_tx; end if;

  if p_customer_id is not null and not exists(select 1 from public.customers where id=p_customer_id and business_id=p_business_id and deleted_at is null) then
    raise exception 'Customer not found';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    item_qty := (item->>'quantity')::numeric;
    if item_qty is null or item_qty<=0 then raise exception 'Invalid quantity'; end if;
    select * into product_row
    from public.products p
    where p.id=(item->>'product_id')::uuid and p.business_id=p_business_id and p.is_active=true
    for update;
    if product_row.id is null then raise exception 'Product not found'; end if;
    if product_row.stock < item_qty then raise exception 'Insufficient stock for %',product_row.name; end if;
    total_value := total_value + item_qty * product_row.price;
    total_hpp_value := total_hpp_value + item_qty * product_row.hpp;
  end loop;

  if clean_payment='cash' and coalesce(p_paid_amount,0) < total_value then raise exception 'Insufficient payment'; end if;

  insert into public.transactions(
    business_id,transaction_number,transaction_date,payment_method,
    subtotal,discount,total,amount_received,change_amount,total_hpp,total_profit,
    status,note,customer_id,cashier_name,device_id
  ) values(
    p_business_id,p_transaction_number,now(),clean_payment,
    total_value,0,total_value,coalesce(p_paid_amount,total_value),
    case when clean_payment='cash' then greatest(0,coalesce(p_paid_amount,0)-total_value) else 0 end,
    total_hpp_value,total_value-total_hpp_value,
    'completed',p_note,p_customer_id,p_cashier_name,p_device_id
  ) returning * into tx;

  for item in select * from jsonb_array_elements(p_items) loop
    item_qty := (item->>'quantity')::numeric;
    select * into product_row from public.products p
    where p.id=(item->>'product_id')::uuid and p.business_id=p_business_id and p.is_active=true for update;

    insert into public.transaction_items(
      business_id,transaction_id,product_id,product_name,quantity,unit_price,unit_hpp,subtotal,total_hpp,profit
    ) values(
      p_business_id,tx.id,product_row.id,product_row.name,item_qty,product_row.price,product_row.hpp,
      item_qty*product_row.price,item_qty*product_row.hpp,item_qty*(product_row.price-product_row.hpp)
    );

    update public.products
    set stock=stock-item_qty,updated_at=now()
    where id=product_row.id and business_id=p_business_id;

    insert into public.stock_movements(
      business_id,product_id,type,quantity,previous_stock,new_stock,reference_type,reference_id,note,created_by,device_id
    ) values(
      p_business_id,product_row.id,'sale',item_qty,product_row.stock,product_row.stock-item_qty,
      'transaction',tx.id,'Penjualan',auth.uid()::text,p_device_id
    );
  end loop;

  if p_customer_id is not null then
    update public.customers
    set total_purchase=coalesce(total_purchase,0)+total_value,updated_at=now()
    where id=p_customer_id and business_id=p_business_id;
  end if;

  insert into public.audit_logs(business_id,action,entity_type,entity_id,description,device_id)
  values(p_business_id,'TRANSACTION_CREATE','transaction',tx.id,p_transaction_number||' · '||clean_payment||' · '||total_value,p_device_id);

  return tx;
exception when unique_violation then
  select * into existing_tx from public.transactions
  where business_id=p_business_id and transaction_number=p_transaction_number limit 1;
  if existing_tx.id is not null then return existing_tx; end if;
  raise;
end;
$$;

grant execute on function public.mova_create_transaction(uuid,text,text,numeric,jsonb,uuid,text,text,text) to authenticated;

create function public.mova_cancel_transaction(
  p_business_id uuid,
  p_transaction_id uuid,
  p_device_id text default null
)
returns public.transactions
language plpgsql
security definer
set search_path=public
as $$
declare tx public.transactions; item record; product_row public.products; updated_tx public.transactions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_business_role(p_business_id,array['owner','cashier']) then raise exception 'Not allowed'; end if;
  select * into tx from public.transactions where id=p_transaction_id and business_id=p_business_id for update;
  if tx.id is null then raise exception 'Transaction not found'; end if;
  if tx.status='cancelled' then return tx; end if;
  if tx.status<>'completed' then raise exception 'Transaction cannot be cancelled'; end if;

  for item in select * from public.transaction_items where transaction_id=tx.id and business_id=p_business_id loop
    select * into product_row from public.products where id=item.product_id and business_id=p_business_id for update;
    if product_row.id is null then raise exception 'Product for transaction not found'; end if;
    update public.products set stock=stock+item.quantity,updated_at=now() where id=product_row.id and business_id=p_business_id;
    insert into public.stock_movements(
      business_id,product_id,type,quantity,previous_stock,new_stock,reference_type,reference_id,note,created_by,device_id
    ) values(
      p_business_id,product_row.id,'return',item.quantity,product_row.stock,product_row.stock+item.quantity,
      'transaction_cancel',tx.id,'Pembatalan transaksi',auth.uid()::text,p_device_id
    );
  end loop;

  if tx.customer_id is not null then
    update public.customers
    set total_purchase=greatest(0,coalesce(total_purchase,0)-coalesce(tx.total,0)),updated_at=now()
    where id=tx.customer_id and business_id=p_business_id;
  end if;

  update public.transactions set status='cancelled',updated_at=now()
  where id=tx.id returning * into updated_tx;

  insert into public.audit_logs(business_id,action,entity_type,entity_id,description,device_id)
  values(p_business_id,'TRANSACTION_CANCEL','transaction',tx.id,tx.transaction_number||' dibatalkan',p_device_id);

  return updated_tx;
end;
$$;

grant execute on function public.mova_cancel_transaction(uuid,uuid,text) to authenticated;

create function public.mova_add_expense(
  p_business_id uuid,
  p_category text,
  p_description text,
  p_amount numeric,
  p_payment_source text,
  p_expense_date date,
  p_device_id text default null
)
returns public.expenses
language plpgsql
security definer
set search_path=public
as $$
declare row_exp public.expenses;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_business_role(p_business_id,array['owner','cashier']) then raise exception 'Not allowed'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'Amount must be greater than zero'; end if;
  if lower(coalesce(p_payment_source,'')) not in ('cash','qris') then raise exception 'Invalid payment source'; end if;

  insert into public.expenses(business_id,category,description,amount,payment_source,expense_date,device_id)
  values(
    p_business_id,
    coalesce(nullif(btrim(p_category),''),'Lainnya'),
    nullif(btrim(coalesce(p_description,'')),''),
    p_amount,
    lower(p_payment_source),
    coalesce(p_expense_date,current_date),
    p_device_id
  ) returning * into row_exp;

  insert into public.audit_logs(business_id,action,entity_type,entity_id,description,device_id)
  values(p_business_id,'EXPENSE_CREATE','expense',row_exp.id,row_exp.category||' · '||row_exp.amount,p_device_id);
  return row_exp;
end;
$$;

grant execute on function public.mova_add_expense(uuid,text,text,numeric,text,date,text) to authenticated;

create function public.mova_close_day(
  p_business_id uuid,
  p_closing_date date,
  p_summary jsonb,
  p_device_id text default null
)
returns public.daily_closings
language plpgsql
security definer
set search_path=public
as $$
declare row_close public.daily_closings;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_business_role(p_business_id,array['owner','cashier']) then raise exception 'Not allowed'; end if;
  insert into public.daily_closings(
    business_id,closing_date,total_omzet,total_hpp,total_gross_profit,total_expense,net_profit,
    cash_amount,qris_amount,transaction_count,items_sold,closed_at,device_id
  ) values(
    p_business_id,p_closing_date,
    coalesce((p_summary->>'omzet')::numeric,0),
    coalesce((p_summary->>'hpp')::numeric,0),
    coalesce((p_summary->>'gross')::numeric,0),
    coalesce((p_summary->>'expense')::numeric,0),
    coalesce((p_summary->>'net')::numeric,0),
    coalesce((p_summary->>'cash')::numeric,0),
    coalesce((p_summary->>'qris')::numeric,0),
    coalesce((p_summary->>'transactions')::integer,0),
    coalesce((p_summary->>'itemsSold')::numeric,0),
    now(),p_device_id
  ) returning * into row_close;

  insert into public.audit_logs(business_id,action,entity_type,entity_id,description,device_id)
  values(p_business_id,'DAY_CLOSED','daily_closings',row_close.id,p_closing_date::text,p_device_id);
  return row_close;
exception when unique_violation then
  raise exception 'Day is already closed';
end;
$$;

grant execute on function public.mova_close_day(uuid,date,jsonb,text) to authenticated;

create function public.mova_reconcile_cash(
  p_business_id uuid,
  p_reconciliation_date date,
  p_system_cash numeric,
  p_physical_cash numeric,
  p_device_id text default null
)
returns public.cash_reconciliations
language plpgsql
security definer
set search_path=public
as $$
declare row_rec public.cash_reconciliations; diff numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_business_role(p_business_id,array['owner','cashier']) then raise exception 'Not allowed'; end if;
  diff:=coalesce(p_physical_cash,0)-coalesce(p_system_cash,0);
  insert into public.cash_reconciliations(
    business_id,reconciliation_date,system_cash,physical_cash,difference,status,created_at,device_id
  ) values(
    p_business_id,p_reconciliation_date,p_system_cash,p_physical_cash,diff,
    case when diff=0 then 'match' when diff>0 then 'overage' else 'shortage' end,now(),p_device_id
  ) returning * into row_rec;

  insert into public.audit_logs(business_id,action,entity_type,entity_id,description,device_id)
  values(p_business_id,'CASH_RECONCILE','cash_reconciliations',row_rec.id,p_reconciliation_date::text||' · '||diff,p_device_id);
  return row_rec;
exception when unique_violation then
  raise exception 'Cash reconciliation already exists for this date';
end;
$$;

grant execute on function public.mova_reconcile_cash(uuid,date,numeric,numeric,text) to authenticated;

-- ------------------------------------------------------------
-- 11) Atomic owner-only backup restore.
-- Direct writes to financial tables remain blocked by RLS; this
-- SECURITY DEFINER RPC validates the workspace and restores the
-- backup in one database transaction.
-- ------------------------------------------------------------
create function public.mova_restore_backup(
  p_business_id uuid,
  p_backup jsonb,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  restored_count integer := 0;
  n integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_business_role(p_business_id,array['owner']) then raise exception 'Only the business owner can restore backups'; end if;
  if p_backup is null or jsonb_typeof(p_backup) <> 'object' then raise exception 'Invalid backup payload'; end if;

  -- Catalog first so product foreign keys remain valid.
  insert into public.brands(
    id,business_id,name,description,is_active,created_at,updated_at,deleted_at
  )
  select r.id,p_business_id,r.name,r.description,r.is_active,r.created_at,r.updated_at,r.deleted_at
  from jsonb_populate_recordset(null::public.brands,coalesce(p_backup->'brands','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,name=excluded.name,description=excluded.description,
    is_active=excluded.is_active,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
  where public.brands.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.categories(
    id,business_id,name,description,is_active,created_at,updated_at,deleted_at
  )
  select r.id,p_business_id,r.name,r.description,r.is_active,r.created_at,r.updated_at,r.deleted_at
  from jsonb_populate_recordset(null::public.categories,coalesce(p_backup->'categories','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,name=excluded.name,description=excluded.description,
    is_active=excluded.is_active,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
  where public.categories.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.products(
    id,business_id,brand_id,category_id,name,sku,unit,price,hpp,stock,min_stock,image_url,is_active,created_at,updated_at,deleted_at
  )
  select r.id,p_business_id,r.brand_id,r.category_id,r.name,upper(btrim(r.sku)),coalesce(r.unit,'pcs'),r.price,r.hpp,
         r.stock,r.min_stock,r.image_url,r.is_active,r.created_at,r.updated_at,r.deleted_at
  from jsonb_populate_recordset(null::public.products,coalesce(p_backup->'products','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,brand_id=excluded.brand_id,category_id=excluded.category_id,
    name=excluded.name,sku=excluded.sku,unit=excluded.unit,price=excluded.price,hpp=excluded.hpp,
    stock=excluded.stock,min_stock=excluded.min_stock,image_url=excluded.image_url,is_active=excluded.is_active,
    created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
  where public.products.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.customers(
    id,business_id,name,phone,note,total_purchase,created_at,updated_at,deleted_at
  )
  select r.id,p_business_id,r.name,r.phone,r.note,r.total_purchase,r.created_at,r.updated_at,r.deleted_at
  from jsonb_populate_recordset(null::public.customers,coalesce(p_backup->'customers','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,name=excluded.name,phone=excluded.phone,note=excluded.note,
    total_purchase=excluded.total_purchase,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
  where public.customers.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.business_settings(
    id,business_id,business_name,tagline,address,phone,instagram,default_cashier,receipt_footer,logo_url,
    pin_hash,pin_salt,pin_enabled,theme,created_at,updated_at
  )
  select r.id,p_business_id,r.business_name,r.tagline,r.address,r.phone,r.instagram,r.default_cashier,r.receipt_footer,
         r.logo_url,r.pin_hash,r.pin_salt,r.pin_enabled,r.theme,r.created_at,r.updated_at
  from jsonb_populate_recordset(null::public.business_settings,coalesce(p_backup->'business_settings','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (business_id) do update set
    business_name=excluded.business_name,tagline=excluded.tagline,address=excluded.address,phone=excluded.phone,
    instagram=excluded.instagram,default_cashier=excluded.default_cashier,receipt_footer=excluded.receipt_footer,
    logo_url=excluded.logo_url,pin_hash=excluded.pin_hash,pin_salt=excluded.pin_salt,pin_enabled=excluded.pin_enabled,
    theme=excluded.theme,updated_at=excluded.updated_at;
  get diagnostics n=row_count; restored_count := restored_count+n;

  -- Transaction header before transaction items / stock references.
  insert into public.transactions(
    id,business_id,transaction_number,transaction_date,payment_method,subtotal,discount,total,amount_received,
    change_amount,total_hpp,total_profit,status,note,customer_id,cashier_name,device_id,created_at,updated_at,deleted_at
  )
  select r.id,p_business_id,r.transaction_number,r.transaction_date,r.payment_method,r.subtotal,r.discount,r.total,
         r.amount_received,r.change_amount,r.total_hpp,r.total_profit,r.status,r.note,r.customer_id,r.cashier_name,
         r.device_id,r.created_at,r.updated_at,r.deleted_at
  from jsonb_populate_recordset(null::public.transactions,coalesce(p_backup->'transactions','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,transaction_number=excluded.transaction_number,transaction_date=excluded.transaction_date,
    payment_method=excluded.payment_method,subtotal=excluded.subtotal,discount=excluded.discount,total=excluded.total,
    amount_received=excluded.amount_received,change_amount=excluded.change_amount,total_hpp=excluded.total_hpp,
    total_profit=excluded.total_profit,status=excluded.status,note=excluded.note,customer_id=excluded.customer_id,
    cashier_name=excluded.cashier_name,device_id=excluded.device_id,created_at=excluded.created_at,updated_at=excluded.updated_at,
    deleted_at=excluded.deleted_at
  where public.transactions.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.transaction_items(
    id,business_id,transaction_id,product_id,product_name,quantity,unit_price,unit_hpp,subtotal,total_hpp,profit,created_at
  )
  select r.id,p_business_id,r.transaction_id,r.product_id,r.product_name,r.quantity,r.unit_price,r.unit_hpp,r.subtotal,r.total_hpp,r.profit,r.created_at
  from jsonb_populate_recordset(null::public.transaction_items,coalesce(p_backup->'transaction_items','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,transaction_id=excluded.transaction_id,product_id=excluded.product_id,
    product_name=excluded.product_name,quantity=excluded.quantity,unit_price=excluded.unit_price,unit_hpp=excluded.unit_hpp,
    subtotal=excluded.subtotal,total_hpp=excluded.total_hpp,profit=excluded.profit,created_at=excluded.created_at
  where public.transaction_items.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.stock_movements(
    id,business_id,product_id,type,quantity,previous_stock,new_stock,reference_type,reference_id,note,created_at,created_by,device_id
  )
  select r.id,p_business_id,r.product_id,r.type,r.quantity,r.previous_stock,r.new_stock,r.reference_type,r.reference_id,r.note,r.created_at,r.created_by,r.device_id
  from jsonb_populate_recordset(null::public.stock_movements,coalesce(p_backup->'stock_movements','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,product_id=excluded.product_id,type=excluded.type,quantity=excluded.quantity,
    previous_stock=excluded.previous_stock,new_stock=excluded.new_stock,reference_type=excluded.reference_type,
    reference_id=excluded.reference_id,note=excluded.note,created_at=excluded.created_at,created_by=excluded.created_by,device_id=excluded.device_id
  where public.stock_movements.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.expenses(
    id,business_id,category,description,amount,payment_source,expense_date,note,device_id,created_at,updated_at,deleted_at
  )
  select r.id,p_business_id,r.category,r.description,r.amount,r.payment_source,r.expense_date,r.note,r.device_id,r.created_at,r.updated_at,r.deleted_at
  from jsonb_populate_recordset(null::public.expenses,coalesce(p_backup->'expenses','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,category=excluded.category,description=excluded.description,amount=excluded.amount,
    payment_source=excluded.payment_source,expense_date=excluded.expense_date,note=excluded.note,device_id=excluded.device_id,
    created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
  where public.expenses.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.daily_closings(
    id,business_id,closing_date,total_omzet,total_hpp,total_gross_profit,total_expense,net_profit,cash_amount,qris_amount,
    transaction_count,items_sold,note,closed_at,device_id
  )
  select r.id,p_business_id,r.closing_date,r.total_omzet,r.total_hpp,r.total_gross_profit,r.total_expense,r.net_profit,r.cash_amount,
         r.qris_amount,r.transaction_count,r.items_sold,r.note,r.closed_at,r.device_id
  from jsonb_populate_recordset(null::public.daily_closings,coalesce(p_backup->'daily_closings','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (business_id,closing_date) do update set
    total_omzet=excluded.total_omzet,total_hpp=excluded.total_hpp,total_gross_profit=excluded.total_gross_profit,
    total_expense=excluded.total_expense,net_profit=excluded.net_profit,cash_amount=excluded.cash_amount,qris_amount=excluded.qris_amount,
    transaction_count=excluded.transaction_count,items_sold=excluded.items_sold,note=excluded.note,closed_at=excluded.closed_at,device_id=excluded.device_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.cash_reconciliations(
    id,business_id,reconciliation_date,system_cash,physical_cash,difference,status,note,created_at,device_id
  )
  select r.id,p_business_id,r.reconciliation_date,r.system_cash,r.physical_cash,r.difference,r.status,r.note,r.created_at,r.device_id
  from jsonb_populate_recordset(null::public.cash_reconciliations,coalesce(p_backup->'cash_reconciliations','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (business_id,reconciliation_date) do update set
    system_cash=excluded.system_cash,physical_cash=excluded.physical_cash,difference=excluded.difference,
    status=excluded.status,note=excluded.note,created_at=excluded.created_at,device_id=excluded.device_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.audit_logs(
    id,business_id,action,entity_type,entity_id,old_data,new_data,description,device_id,created_at
  )
  select r.id,p_business_id,r.action,r.entity_type,r.entity_id,r.old_data,r.new_data,r.description,r.device_id,r.created_at
  from jsonb_populate_recordset(null::public.audit_logs,coalesce(p_backup->'audit_logs','[]'::jsonb)) r
  where r.id is not null and coalesce(r.business_id,p_business_id)=p_business_id
  on conflict (id) do update set
    business_id=excluded.business_id,action=excluded.action,entity_type=excluded.entity_type,entity_id=excluded.entity_id,
    old_data=excluded.old_data,new_data=excluded.new_data,description=excluded.description,device_id=excluded.device_id,created_at=excluded.created_at
  where public.audit_logs.business_id = p_business_id;
  get diagnostics n=row_count; restored_count := restored_count+n;

  insert into public.audit_logs(business_id,action,entity_type,description,device_id)
  values(p_business_id,'BACKUP_RESTORE','system','Backup dipulihkan melalui MŌVA 4.2.1',p_device_id);

  return jsonb_build_object('ok',true,'restored',restored_count);
end;
$$;

grant execute on function public.mova_restore_backup(uuid,jsonb,text) to authenticated;

-- ------------------------------------------------------------
-- 11) Business plan guard.
-- ------------------------------------------------------------
create function public.protect_business_plan()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is not null and new.plan is distinct from old.plan and not exists(
    select 1 from public.subscriptions s
    where s.business_id=old.id and s.plan='pro' and s.status in ('active','trialing','grace')
  ) then
    -- Allow secure server-side plan transition only by service_role.
    if auth.role() <> 'service_role' then
      raise exception 'Plan dikelola oleh sistem langganan MŌVA';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_business_plan on public.businesses;
create trigger trg_protect_business_plan before update on public.businesses
for each row execute function public.protect_business_plan();

-- ------------------------------------------------------------
-- 12) RLS — business scoped, no permissive fallback policies.
-- ------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.device_registry enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.customers enable row level security;
alter table public.expenses enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.daily_closings enable row level security;
alter table public.cash_reconciliations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;

create policy mova_business_select on public.businesses
for select to authenticated using (public.is_business_member(id));
create policy mova_business_insert on public.businesses
for insert to authenticated with check (owner_id=auth.uid());
create policy mova_business_update on public.businesses
for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy mova_business_delete on public.businesses
for delete to authenticated using (owner_id=auth.uid());

create policy mova_member_select on public.business_members
for select to authenticated using (
  user_id=auth.uid() or exists(
    select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()
  )
);
create policy mova_member_insert on public.business_members
for insert to authenticated with check (
  exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);
create policy mova_member_update on public.business_members
for update to authenticated using (
  exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
) with check (
  exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);
create policy mova_member_delete on public.business_members
for delete to authenticated using (
  exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);

create policy mova_device_select on public.device_registry
for select to authenticated using (public.is_business_member(business_id));

create policy mova_subscription_select on public.subscriptions
for select to authenticated using (public.is_business_member(business_id));

create policy mova_payment_event_select on public.payment_events
for select to authenticated using (public.is_business_member(business_id));
create policy mova_payment_event_insert on public.payment_events
for insert to authenticated with check (public.has_business_role(business_id,array['owner','cashier','payment_terminal']));
create policy mova_payment_event_update on public.payment_events
for update to authenticated using (public.has_business_role(business_id,array['owner','cashier','payment_terminal']))
with check (public.has_business_role(business_id,array['owner','cashier','payment_terminal']));

DO $$
declare t text;
begin
  foreach t in array array[
    'brands','categories','products','transactions','transaction_items','stock_movements',
    'customers','expenses','business_settings','audit_logs','daily_closings','cash_reconciliations'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_business_member(business_id))','mova_select_'||t,t);
  end loop;
end $$;

DO $$
declare t text;
begin
  foreach t in array array['brands','categories','products','business_settings'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_business_role(business_id,array[''owner'']))','mova_owner_insert_'||t,t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_business_role(business_id,array[''owner''])) with check (public.has_business_role(business_id,array[''owner'']))','mova_owner_update_'||t,t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_business_role(business_id,array[''owner'']))','mova_owner_delete_'||t,t);
  end loop;
end $$;

DO $$
declare t text;
begin
  foreach t in array array['customers'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_business_role(business_id,array[''owner'',''cashier'']))','mova_ops_insert_'||t,t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_business_role(business_id,array[''owner'',''cashier''])) with check (public.has_business_role(business_id,array[''owner'',''cashier'']))','mova_ops_update_'||t,t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_business_role(business_id,array[''owner'']))','mova_ops_delete_'||t,t);
  end loop;
end $$;

create policy mova_audit_insert on public.audit_logs
for insert to authenticated with check (public.has_business_role(business_id,array['owner','cashier','payment_terminal']));

-- Financial transaction/stock/expense/closing/reconciliation writes occur via SECURITY DEFINER RPCs.
-- There are intentionally NO direct INSERT/UPDATE/DELETE policies for these tables.

-- ------------------------------------------------------------
-- 13) Grants.
-- ------------------------------------------------------------
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- No anonymous access to business tables.
revoke all on all tables in schema public from anon;

-- ------------------------------------------------------------
-- 14) Storage bucket and scoped object policies.
-- Existing files are preserved.
-- ------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mova-media','mova-media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists mova_media_select on storage.objects;
drop policy if exists mova_media_insert on storage.objects;
drop policy if exists mova_media_update on storage.objects;
drop policy if exists mova_media_delete on storage.objects;

create policy mova_media_select on storage.objects
for select to authenticated
using (
  bucket_id='mova-media'
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_business_member(split_part(name,'/',1)::uuid)
);
create policy mova_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='mova-media'
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_business_role(split_part(name,'/',1)::uuid,array['owner'])
  and split_part(name,'/',2) in ('product','business','background')
);
create policy mova_media_update on storage.objects
for update to authenticated
using (
  bucket_id='mova-media'
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_business_role(split_part(name,'/',1)::uuid,array['owner'])
)
with check (
  bucket_id='mova-media'
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_business_role(split_part(name,'/',1)::uuid,array['owner'])
);
create policy mova_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id='mova-media'
  and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_business_role(split_part(name,'/',1)::uuid,array['owner'])
);

-- ------------------------------------------------------------
-- 15) Realtime is advisory refresh only.
-- ------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.products; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.expenses; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.customers; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.business_settings; exception when duplicate_object then null; when undefined_object then null; end $$;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 16) Final verification.
-- ------------------------------------------------------------
select 'MŌVA FINAL SCHEMA READY' as status;
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'businesses','business_members','device_registry','brands','categories','products',
    'transactions','transaction_items','stock_movements','customers','expenses',
    'business_settings','audit_logs','daily_closings','cash_reconciliations',
    'subscriptions','payment_events'
  )
order by table_name;

select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in (
    'businesses','business_members','device_registry','brands','categories','products',
    'transactions','transaction_items','stock_movements','customers','expenses',
    'business_settings','audit_logs','daily_closings','cash_reconciliations',
    'subscriptions','payment_events'
  )
order by tablename;
