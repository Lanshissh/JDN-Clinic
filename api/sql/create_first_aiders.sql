create extension if not exists pgcrypto;

create table if not exists public.first_aiders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  business_unit text not null,
  training_start_date date not null,
  training_end_date date,
  remarks text,
  assigned_location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists first_aiders_unique_name_training
  on public.first_aiders (full_name, business_unit, training_start_date);

create index if not exists first_aiders_full_name_idx
  on public.first_aiders (full_name);

create index if not exists first_aiders_location_idx
  on public.first_aiders (assigned_location);

create or replace function public.set_first_aiders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists first_aiders_set_updated_at on public.first_aiders;
create trigger first_aiders_set_updated_at
before update on public.first_aiders
for each row execute function public.set_first_aiders_updated_at();

insert into public.first_aiders
  (full_name, business_unit, training_start_date, training_end_date, remarks, assigned_location)
values
  ('Punsalan, Ronald P.', 'eNtec1', '2024-02-27', '2024-02-28', 'Expired Training', 'Entec1'),
  ('Balboa, Ellis James F.', 'JDNHO', '2024-02-27', '2024-02-28', 'Expired Training', 'Entec1'),
  ('Capunihan, Dionisio M.', 'JDNHO', '2024-02-27', '2024-02-28', 'Expired Training', 'Nepo Mart'),
  ('Cuenco, Jamila M.', 'JDNHO', '2024-02-27', '2024-02-28', 'Expired Training', 'Entec 2'),
  ('Nuqui, Syela M.', 'JDNHO', '2024-02-27', '2024-02-28', 'Expired Training', 'Entec 1'),
  ('Tatoy, Sydney C.', 'Connex International Inc.', '2024-02-27', '2024-02-28', 'Resigned', 'Entec 1')
on conflict (full_name, business_unit, training_start_date) do nothing;
