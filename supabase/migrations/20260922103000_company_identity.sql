insert into public.site_settings (key, value)
values (
  'company',
  '{"legalName":"Emilie Cauvier Inc.","brandName":"Mémoire Maison","region":"Montréal–Laval, Québec, Canada","contactEmail":"emilie@equipecauvier.com","privacyOfficer":"Emilie Cauvier","legalAddressStatus":"pending","phoneStatus":"pending","businessNumbersStatus":"pending"}'::jsonb
)
on conflict (key) do update set value = excluded.value, updated_at = now();
