-- Livery Ledger and War Ledger: base database setup (armies, units, photos, sharing).
-- For a new Supabase project, run this first, then supabase/features.sql, then supabase/recipes.sql:
-- SQL Editor -> New query -> paste -> Run. Safe to run again; it only creates what is missing.

-- 1. Armies (one row per ledger) ------------------------------------------------
create table if not exists public.armies (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  faction     text not null,
  name        text not null,
  scheme      jsonb not null default '{}'::jsonb,   -- colours, emblem, rank colours
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists armies_owner_idx on public.armies(owner);

-- 2. Units --------------------------------------------------------------------
create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  army_id     uuid references public.armies(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- datasheet, name, colours, weapons, paints, notes
  image_path  text,                                  -- photo path in the unit-images bucket
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- If you ran the earlier single-army setup, this adds the new column.
alter table public.units add column if not exists army_id uuid references public.armies(id) on delete cascade;
create index if not exists units_army_idx on public.units(army_id);
create index if not exists units_owner_idx on public.units(owner);

-- 3. Row level security: each person sees and edits only their own ledgers -----
alter table public.armies enable row level security;
alter table public.units  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['armies','units'] loop
    execute format('drop policy if exists "%1$s: read own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s: insert own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s: update own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s: delete own" on public.%1$s', t);
    execute format('create policy "%1$s: read own" on public.%1$s for select to authenticated using (owner = auth.uid())', t);
    execute format('create policy "%1$s: insert own" on public.%1$s for insert to authenticated with check (owner = auth.uid())', t);
    execute format('create policy "%1$s: update own" on public.%1$s for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
    execute format('create policy "%1$s: delete own" on public.%1$s for delete to authenticated using (owner = auth.uid())', t);
  end loop;
end $$;

-- A unit must belong to one of your own armies.
drop policy if exists "units: army is yours" on public.units;
create policy "units: army is yours" on public.units as restrictive for insert to authenticated
  with check (army_id is null or exists (select 1 from public.armies a where a.id = army_id and a.owner = auth.uid()));

-- 4. Photo storage ------------------------------------------------------------
-- Public bucket so photos load from their URL. Files live under
-- <user id>/<army id>/<random id>.jpg and only the owner can change them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-images', 'unit-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "unit-images: select own" on storage.objects;
drop policy if exists "unit-images: upload own" on storage.objects;
drop policy if exists "unit-images: update own" on storage.objects;
drop policy if exists "unit-images: delete own" on storage.objects;

create policy "unit-images: select own" on storage.objects for select to authenticated
  using (bucket_id = 'unit-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "unit-images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'unit-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "unit-images: update own" on storage.objects for update to authenticated
  using (bucket_id = 'unit-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "unit-images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'unit-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Sharing ------------------------------------------------------------------
-- A ledger can be shared: anyone with the link can view it, and signed-in players see it on the Shared armies
-- page. The app reads armies where public = true, and the units of those armies.
alter table public.armies add column if not exists public boolean not null default false;
create index if not exists armies_public_idx on public.armies(public) where public;

drop policy if exists "armies: read shared" on public.armies;
create policy "armies: read shared" on public.armies for select to anon, authenticated using (public);
drop policy if exists "units: read shared" on public.units;
create policy "units: read shared" on public.units for select to anon, authenticated
  using (exists (select 1 from public.armies a where a.id = army_id and a.public));
