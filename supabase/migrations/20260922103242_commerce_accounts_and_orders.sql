alter table public.profiles
  add column if not exists company_name text,
  add column if not exists country_code text,
  add column if not exists region_code text,
  add column if not exists postal_code text,
  add column if not exists notification_preferences jsonb not null default '{"project":true,"orders":true,"newsletter":false}'::jsonb;

alter table public.orders
  add column if not exists locale text not null default 'fr' check (locale in ('fr','en')),
  add column if not exists product_code text,
  add column if not exists unit_price_cents integer not null default 0 check (unit_price_cents>=0),
  add column if not exists subtotal_cents integer not null default 0 check (subtotal_cents>=0),
  add column if not exists shipping_cents integer not null default 0 check (shipping_cents>=0),
  add column if not exists tax_cents integer not null default 0 check (tax_cents>=0),
  add column if not exists tax_rate_bps integer check (tax_rate_bps between 0 and 10000),
  add column if not exists tax_jurisdiction text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists customer_email text,
  add column if not exists confirmation_email_status text not null default 'queued' check (confirmation_email_status in ('queued','sent','failed','unavailable')),
  add column if not exists print_pdf_url text,
  add column if not exists interactive_url text,
  add column if not exists payment_provider text,
  add column if not exists payment_reference text;

alter table public.professional_accounts
  add column if not exists organization_type text not null default 'agency' check (organization_type in ('broker','team','agency','network')),
  add column if not exists business_number text,
  add column if not exists tax_numbers jsonb not null default '{}'::jsonb,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists country_code text not null default 'CA',
  add column if not exists region_code text,
  add column if not exists billing_cycle text not null default 'annual' check (billing_cycle in ('monthly','annual')),
  add column if not exists plan_code text not null default 'starter',
  add column if not exists billing_status text not null default 'pending' check (billing_status in ('pending','active','paused','cancelled')),
  add column if not exists renewal_at timestamptz;

create table if not exists public.email_outbox(
  id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id) on delete cascade,user_email text not null,template text not null,subject text not null,payload jsonb not null default '{}'::jsonb,status text not null default 'queued' check(status in ('queued','sent','failed','cancelled')),attempts integer not null default 0 check(attempts>=0),provider_id text,last_error text,created_at timestamptz not null default now(),sent_at timestamptz
);
create index if not exists email_outbox_status_created_idx on public.email_outbox(status,created_at);
create index if not exists email_outbox_order_idx on public.email_outbox(order_id);
alter table public.email_outbox enable row level security;
create policy "email_outbox_admin_all" on public.email_outbox for all to authenticated using((select public.is_app_admin())) with check((select public.is_app_admin()));
grant select on public.email_outbox to authenticated;
create index if not exists orders_owner_status_created_idx on public.orders(owner_id,status,created_at desc);
create index if not exists professional_accounts_business_number_idx on public.professional_accounts(business_number) where business_number is not null;
