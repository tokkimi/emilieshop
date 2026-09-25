alter table public.orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_failure_message text,
  add column if not exists paid_at timestamptz;

create unique index if not exists orders_stripe_checkout_session_idx on public.orders(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists orders_stripe_payment_intent_idx on public.orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

create table if not exists public.stripe_webhook_events(
  id text primary key,
  type text not null,
  livemode boolean not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
