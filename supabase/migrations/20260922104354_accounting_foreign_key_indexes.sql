create index if not exists journal_entries_created_by_idx on public.journal_entries(created_by) where created_by is not null;
create index if not exists journal_entries_order_id_idx on public.journal_entries(order_id) where order_id is not null;
