create or replace function public.is_app_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'emilie@equipecauvier.com';
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

create policy "newsletter_public_insert"
on public.newsletter_subscribers for insert
to anon, authenticated
with check (
  status = 'pending'
  and consent_source = 'website-explicit-opt-in'
  and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
);

create policy "newsletter_admin_all"
on public.newsletter_subscribers for all
to authenticated
using ((select public.is_app_admin()))
with check ((select public.is_app_admin()));

create policy "analytics_public_insert"
on public.analytics_events for insert
to anon, authenticated
with check (
  char_length(visitor_id) between 1 and 100
  and char_length(event_name) between 1 and 80
  and char_length(path) between 1 and 300
);

create policy "analytics_admin_select"
on public.analytics_events for select
to authenticated
using ((select public.is_app_admin()));

create policy "site_settings_public_select"
on public.site_settings for select
to anon, authenticated
using (true);

create policy "site_settings_admin_write"
on public.site_settings for all
to authenticated
using ((select public.is_app_admin()))
with check ((select public.is_app_admin()));

create policy "audit_logs_admin_access"
on public.audit_logs for select
to authenticated
using ((select public.is_app_admin()));

create policy "audit_logs_admin_insert"
on public.audit_logs for insert
to authenticated
with check ((select public.is_app_admin()));

create policy "profiles_admin_all" on public.profiles for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "projects_admin_all" on public.projects for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "media_admin_all" on public.media for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "generations_admin_all" on public.book_generations for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "approvals_admin_all" on public.approvals for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "orders_admin_all" on public.orders for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "memory_links_admin_all" on public.memory_links for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "threads_admin_all" on public.message_threads for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "messages_admin_all" on public.messages for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "professional_accounts_admin_all" on public.professional_accounts for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "professional_invitations_admin_all" on public.professional_invitations for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "data_requests_admin_all" on public.data_requests for all to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));

grant usage on schema public to anon;
grant insert on public.newsletter_subscribers, public.analytics_events to anon;
grant select on public.site_settings to anon;
grant select, insert, update, delete on
  public.profiles,
  public.projects,
  public.media,
  public.book_generations,
  public.approvals,
  public.orders,
  public.memory_links,
  public.message_threads,
  public.messages,
  public.professional_accounts,
  public.professional_invitations,
  public.newsletter_subscribers,
  public.analytics_events,
  public.site_settings,
  public.data_requests
to authenticated;
grant select, insert on public.audit_logs to authenticated;

create index if not exists analytics_events_user_idx on public.analytics_events (user_id);
create index if not exists approvals_generation_idx on public.approvals (generation_id);
create index if not exists approvals_owner_idx on public.approvals (owner_id);
create index if not exists message_threads_project_idx on public.message_threads (project_id);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists orders_project_idx on public.orders (project_id);
create index if not exists professional_invitations_created_by_idx on public.professional_invitations (created_by);
create index if not exists site_settings_updated_by_idx on public.site_settings (updated_by);
