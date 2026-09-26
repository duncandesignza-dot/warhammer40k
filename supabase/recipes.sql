-- Livery Ledger: recipe library
-- Keeps each person's paint recipes on their account so every ledger can use them.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste this -> Run.
-- Safe to run again.
-- On a brand-new Supabase project, run supabase/setup.sql first.

create table if not exists public.recipes (
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

alter table public.recipes enable row level security;

-- Each person can only see and change their own recipes.
drop policy if exists "recipes: read own" on public.recipes;
create policy "recipes: read own" on public.recipes
  for select using (owner = auth.uid());

drop policy if exists "recipes: add own" on public.recipes;
create policy "recipes: add own" on public.recipes
  for insert with check (owner = auth.uid());

drop policy if exists "recipes: change own" on public.recipes;
create policy "recipes: change own" on public.recipes
  for update using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "recipes: delete own" on public.recipes;
create policy "recipes: delete own" on public.recipes
  for delete using (owner = auth.uid());

grant select, insert, update, delete on public.recipes to authenticated;
