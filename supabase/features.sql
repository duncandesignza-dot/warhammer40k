-- Livery Ledger: database setup for newer features.
-- Run this once in Supabase: SQL Editor -> New query -> paste all of this -> Run.
-- It's safe to run again; it only adds what's missing.

-- 1. Delete account (Settings -> Delete my account)
--    Lets a logged-in painter delete their own account and everything saved with it.
--    The site removes their photos from storage first.
drop function if exists public.delete_my_account();
create or replace function public.delete_my_account(dry boolean default false)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if dry then return; end if;   -- the site checks this is set up before removing anything
  delete from public.units where owner = uid;
  delete from public.armies where owner = uid;
  if to_regclass('public.recipes') is not null then execute 'delete from public.recipes where owner = $1' using uid; end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;

-- 2. Likes on shared armies (Shared armies page)
create table if not exists public.likes (
  army_id uuid not null references public.armies(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (army_id, user_id)
);
alter table public.likes enable row level security;
drop policy if exists "Logged-in painters see likes" on public.likes;
create policy "Logged-in painters see likes" on public.likes for select to authenticated using (true);
drop policy if exists "Like shared armies as yourself" on public.likes;
create policy "Like shared armies as yourself" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.armies a where a.id = army_id and a.public));
drop policy if exists "Remove your own likes" on public.likes;
create policy "Remove your own likes" on public.likes for delete to authenticated using (user_id = auth.uid());

-- 3. Following painters (Shared armies -> Following)
create table if not exists public.follows (
  follower uuid not null default auth.uid() references auth.users(id) on delete cascade,
  followee uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
alter table public.follows enable row level security;
drop policy if exists "See who you follow and who follows you" on public.follows;
create policy "See who you follow and who follows you" on public.follows for select to authenticated
  using (follower = auth.uid() or followee = auth.uid());
drop policy if exists "Follow as yourself" on public.follows;
create policy "Follow as yourself" on public.follows for insert to authenticated with check (follower = auth.uid());
drop policy if exists "Unfollow as yourself" on public.follows;
create policy "Unfollow as yourself" on public.follows for delete to authenticated using (follower = auth.uid());

-- 4. Pile of shame (kits you've bought but not started)
--    Kept in its own table so a big pile doesn't bloat your login.
create table if not exists public.kits (
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
alter table public.kits enable row level security;
drop policy if exists "Your own kits" on public.kits;
create policy "Your own kits" on public.kits for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- 5. Paints you own (Paints & recipes -> My paints)
--    One row per painter, kept out of the login for the same reason as the pile of shame.
create table if not exists public.owned_paints (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  paints jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.owned_paints enable row level security;
drop policy if exists "Your own paints" on public.owned_paints;
create policy "Your own paints" on public.owned_paints for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
