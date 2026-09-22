create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  phone text,
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'en')),
  shipping_address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Notre Maison',
  address text,
  years text,
  collection text not null default 'Essentiel',
  cover_color text not null default 'forest',
  status text not null default 'draft' check (status in ('draft', 'generating', 'preview', 'changes_requested', 'approved', 'production', 'shipped', 'delivered', 'archived')),
  progress smallint not null default 10 check (progress between 0 and 100),
  answers jsonb not null default '{}'::jsonb,
  options jsonb not null default '[]'::jsonb,
  locked_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);
create index projects_status_updated_idx on public.projects (status, updated_at desc);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  object_key text not null unique,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 52428800),
  kind text not null default 'photo' check (kind in ('photo', 'video', 'audio')),
  width integer,
  height integer,
  duration_seconds numeric(10, 2),
  created_at timestamptz not null default now()
);

create index media_project_created_idx on public.media (project_id, created_at);
create index media_owner_idx on public.media (owner_id);

create table public.book_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  status text not null default 'ready' check (status in ('queued', 'generating', 'ready', 'approved', 'superseded', 'failed')),
  model text not null,
  input_data jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  usage_data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index book_generations_project_updated_idx on public.book_generations (project_id, updated_at desc);
create index book_generations_owner_idx on public.book_generations (owner_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  generation_id uuid references public.book_generations(id) on delete set null,
  version integer not null default 1,
  version_hash text not null,
  approved_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create index approvals_project_approved_idx on public.approvals (project_id, approved_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  project_id uuid not null references public.projects(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'awaiting_payment', 'paid', 'preflight', 'printing', 'shipped', 'delivered', 'cancelled', 'refunded', 'blocked')),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'CAD',
  quantity integer not null default 1 check (quantity between 1 and 100),
  shipping_address jsonb not null default '{}'::jsonb,
  print_approved_at timestamptz,
  lulu_print_job_id text,
  tracking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_owner_created_idx on public.orders (owner_id, created_at desc);
create index orders_status_updated_idx on public.orders (status, updated_at desc);

create table public.memory_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  access_code_hash text,
  status text not null default 'private' check (status in ('private', 'family', 'paused', 'expired')),
  allow_downloads boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memory_links_owner_idx on public.memory_links (owner_id);

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  subject text not null default 'Projet Mémoire Maison',
  status text not null default 'open' check (status in ('open', 'waiting_customer', 'waiting_team', 'closed')),
  unread_customer integer not null default 0 check (unread_customer >= 0),
  unread_admin integer not null default 0 check (unread_admin >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index message_threads_user_updated_idx on public.message_threads (user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 5000),
  attachment_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_created_idx on public.messages (thread_id, created_at);

create table public.professional_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  organization_name text not null,
  branding jsonb not null default '{}'::jsonb,
  credits_purchased integer not null default 0 check (credits_purchased >= 0),
  credits_used integer not null default 0 check (credits_used >= 0 and credits_used <= credits_purchased),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index professional_accounts_owner_idx on public.professional_accounts (owner_id);

create table public.professional_invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.professional_accounts(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending' check (status in ('pending', 'opened', 'started', 'completed', 'expired', 'cancelled')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index professional_invitations_account_idx on public.professional_invitations (account_id, created_at desc);

create table public.newsletter_subscribers (
  email text primary key,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  segment text not null default 'owner',
  status text not null default 'pending' check (status in ('pending', 'subscribed', 'unsubscribed', 'bounced')),
  consent_source text not null,
  consent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribe_token_hash text,
  unsubscribed_at timestamptz
);

create index newsletter_status_segment_idx on public.newsletter_subscribers (status, segment);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_name_created_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_path_created_idx on public.analytics_events (path, created_at desc);

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_created_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'deletion', 'correction')),
  status text not null default 'received' check (status in ('received', 'verified', 'processing', 'completed', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index data_requests_user_created_idx on public.data_requests (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.media enable row level security;
alter table public.book_generations enable row level security;
alter table public.approvals enable row level security;
alter table public.orders enable row level security;
alter table public.memory_links enable row level security;
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.professional_accounts enable row level security;
alter table public.professional_invitations enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.analytics_events enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.data_requests enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "projects_select_own" on public.projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy "projects_insert_own" on public.projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "projects_update_own" on public.projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "projects_delete_own" on public.projects for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "media_select_own" on public.media for select to authenticated using ((select auth.uid()) = owner_id);
create policy "media_insert_own" on public.media for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "media_update_own" on public.media for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "media_delete_own" on public.media for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "generations_select_own" on public.book_generations for select to authenticated using ((select auth.uid()) = owner_id);
create policy "generations_insert_own" on public.book_generations for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "generations_update_own" on public.book_generations for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "approvals_select_own" on public.approvals for select to authenticated using ((select auth.uid()) = owner_id);
create policy "approvals_insert_own" on public.approvals for insert to authenticated with check ((select auth.uid()) = owner_id);

create policy "orders_select_own" on public.orders for select to authenticated using ((select auth.uid()) = owner_id);
create policy "memory_links_all_own" on public.memory_links for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "threads_select_own" on public.message_threads for select to authenticated using ((select auth.uid()) = user_id);
create policy "threads_insert_own" on public.message_threads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "threads_update_own" on public.message_threads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "messages_select_own_thread" on public.messages for select to authenticated using (exists (select 1 from public.message_threads t where t.id = thread_id and t.user_id = (select auth.uid())));
create policy "messages_insert_own_thread" on public.messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists (select 1 from public.message_threads t where t.id = thread_id and t.user_id = (select auth.uid())));

create policy "professional_accounts_all_own" on public.professional_accounts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "professional_invitations_select_own" on public.professional_invitations for select to authenticated using (exists (select 1 from public.professional_accounts a where a.id = account_id and a.owner_id = (select auth.uid())));
create policy "professional_invitations_insert_own" on public.professional_invitations for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.professional_accounts a where a.id = account_id and a.owner_id = (select auth.uid())));
create policy "professional_invitations_update_own" on public.professional_invitations for update to authenticated using (exists (select 1 from public.professional_accounts a where a.id = account_id and a.owner_id = (select auth.uid()))) with check (exists (select 1 from public.professional_accounts a where a.id = account_id and a.owner_id = (select auth.uid())));
create policy "data_requests_select_own" on public.data_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "data_requests_insert_own" on public.data_requests for insert to authenticated with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.media to authenticated;
grant select, insert, update on public.book_generations to authenticated;
grant select, insert on public.approvals to authenticated;
grant select on public.orders to authenticated;
grant select, insert, update, delete on public.memory_links to authenticated;
grant select, insert, update on public.message_threads to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.professional_accounts to authenticated;
grant select, insert, update on public.professional_invitations to authenticated;
grant select, insert on public.data_requests to authenticated;

create policy "project_media_select_own" on storage.objects for select to authenticated using (bucket_id = 'project-media' and owner_id = (select auth.uid()::text));
create policy "project_media_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'project-media' and owner_id = (select auth.uid()::text) and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "project_media_update_own" on storage.objects for update to authenticated using (bucket_id = 'project-media' and owner_id = (select auth.uid()::text)) with check (bucket_id = 'project-media' and owner_id = (select auth.uid()::text));
create policy "project_media_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'project-media' and owner_id = (select auth.uid()::text));
