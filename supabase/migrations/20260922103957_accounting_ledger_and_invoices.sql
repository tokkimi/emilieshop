alter table public.orders
  add column if not exists provider_cost_cents integer not null default 0 check(provider_cost_cents>=0),
  add column if not exists payment_fee_cents integer not null default 0 check(payment_fee_cents>=0),
  add column if not exists refund_cents integer not null default 0 check(refund_cents>=0),
  add column if not exists invoice_number text,
  add column if not exists invoice_issued_at timestamptz;

create unique index if not exists orders_invoice_number_idx on public.orders(invoice_number) where invoice_number is not null;

create table public.accounting_accounts(
  code text primary key,
  name text not null,
  account_type text not null check(account_type in ('asset','liability','equity','revenue','expense')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.accounting_accounts(code,name,account_type) values
('1000','Banque et encaisse','asset'),('1100','Comptes clients','asset'),('2100','Taxes à remettre','liability'),('2200','Comptes fournisseurs','liability'),('3000','Résultats non distribués','equity'),('4000','Ventes de livres et services','revenue'),('4100','Revenus professionnels','revenue'),('5000','Coûts d’impression','expense'),('5100','Livraison','expense'),('5200','Frais de paiement','expense'),('6000','Dépenses d’exploitation','expense')
on conflict(code) do nothing;

create table public.journal_entries(
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  reference text not null unique,
  description text not null,
  source text not null default 'manual' check(source in ('manual','order','refund','supplier','adjustment')),
  status text not null default 'posted' check(status in ('draft','posted','void')),
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index journal_entries_date_idx on public.journal_entries(entry_date desc);

create table public.journal_lines(
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null references public.accounting_accounts(code),
  debit_cents integer not null default 0 check(debit_cents>=0),
  credit_cents integer not null default 0 check(credit_cents>=0),
  memo text,
  check((debit_cents>0 and credit_cents=0) or (credit_cents>0 and debit_cents=0))
);
create index journal_lines_entry_idx on public.journal_lines(entry_id);
create index journal_lines_account_idx on public.journal_lines(account_code);

alter table public.accounting_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
create policy "accounting_accounts_admin" on public.accounting_accounts for all to authenticated using((select public.is_app_admin())) with check((select public.is_app_admin()));
create policy "journal_entries_admin" on public.journal_entries for all to authenticated using((select public.is_app_admin())) with check((select public.is_app_admin()));
create policy "journal_lines_admin" on public.journal_lines for all to authenticated using((select public.is_app_admin())) with check((select public.is_app_admin()));
grant select,insert,update on public.accounting_accounts to authenticated;
grant select,insert,update on public.journal_entries to authenticated;
grant select,insert,update on public.journal_lines to authenticated;
