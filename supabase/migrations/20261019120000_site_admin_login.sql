-- Dedicated admin login (admin@memoiremaison.com) gets the same rights as the owner.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('emilie@equipecauvier.com', 'admin@memoiremaison.com');
$$;

-- Private bucket for the photos and files clients upload.
insert into storage.buckets (id, name, public)
values ('project-media', 'project-media', false)
on conflict (id) do nothing;
