create table if not exists public.print_artifacts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  generation_id uuid not null references public.book_generations(id) on delete restrict,
  approval_id uuid not null references public.approvals(id) on delete restrict,
  version integer not null check (version > 0),
  version_hash text not null,
  pod_package_id text not null,
  page_count integer not null check (page_count between 24 and 800),
  interior_object_key text not null,
  cover_object_key text not null,
  interior_md5 text not null,
  cover_md5 text not null,
  cover_width_pt numeric(12,3) not null,
  cover_height_pt numeric(12,3) not null,
  warnings jsonb not null default '[]'::jsonb,
  interior_validation_id text,
  cover_validation_id text,
  interior_validation_status text,
  cover_validation_status text,
  cost_quote jsonb,
  status text not null default 'prepared' check (status in ('prepared','validating','validated','submitted','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_artifacts_project_idx on public.print_artifacts(project_id, created_at desc);
create index if not exists print_artifacts_status_idx on public.print_artifacts(status, updated_at desc);
alter table public.print_artifacts enable row level security;
create policy "print_artifacts_owner_read" on public.print_artifacts for select to authenticated using(owner_id=(select auth.uid()));
create policy "print_artifacts_admin_all" on public.print_artifacts for all to authenticated using((select public.is_app_admin())) with check((select public.is_app_admin()));
grant select on public.print_artifacts to authenticated;

alter table public.orders
  add column if not exists print_artifact_id uuid references public.print_artifacts(id) on delete set null,
  add column if not exists lulu_status text,
  add column if not exists lulu_cost_quote jsonb;

create index if not exists orders_print_artifact_idx on public.orders(print_artifact_id) where print_artifact_id is not null;
