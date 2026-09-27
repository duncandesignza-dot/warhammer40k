-- Livery Ledger: database setup for newer features.
-- Run this once in Supabase: SQL Editor -> New query -> paste all of this -> Run.
-- It's safe to run again; it only adds what's missing.
-- On a brand-new Supabase project, run supabase/setup.sql first.

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

-- 3. (Removed.) Following people: replaced by following armies (3b), which copies the old follows once.

-- 3b. Following armies (Follow army on Shared armies -> Following)
create table if not exists public.army_follows (
  army_id uuid not null references public.armies(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (army_id, user_id)
);
alter table public.army_follows enable row level security;
drop policy if exists "See armies you follow, and who follows yours" on public.army_follows;
create policy "See armies you follow, and who follows yours" on public.army_follows for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.armies a where a.id = army_id and a.owner = auth.uid()));
drop policy if exists "Follow shared armies as yourself" on public.army_follows;
create policy "Follow shared armies as yourself" on public.army_follows for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.armies a where a.id = army_id and a.public and a.owner <> auth.uid()));
drop policy if exists "Unfollow armies as yourself" on public.army_follows;
create policy "Unfollow armies as yourself" on public.army_follows for delete to authenticated using (user_id = auth.uid());
-- Anyone who followed a person now follows each army that person shares, once: the old table is
-- dropped afterwards, so running this file again doesn't bring back follows people have since removed.
do $$ begin
  if to_regclass('public.follows') is not null then
    insert into public.army_follows (army_id, user_id)
      select a.id, f.follower from public.follows f join public.armies a on a.owner = f.followee and a.public
      on conflict do nothing;
    drop table public.follows;
  end if;
end $$;

-- 4. (Removed.) Drops the old kits table.
drop table if exists public.kits;

-- 5. Paints you own (Paints & recipes -> My paints)
--    One row per player, kept in its own table so a long list doesn't bloat your login.
create table if not exists public.owned_paints (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  paints jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.owned_paints enable row level security;
drop policy if exists "Your own paints" on public.owned_paints;
create policy "Your own paints" on public.owned_paints for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- 6. War Ledger: army lists (what you take to a game, picked from your collection)
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  army_id uuid not null references public.armies(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_owner_idx on public.lists(owner);
alter table public.lists enable row level security;
drop policy if exists "Your own lists" on public.lists;
create policy "Your own lists" on public.lists for all to authenticated using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from public.armies a where a.id = army_id and a.owner = auth.uid()));

-- 7. War Ledger: battle reports (games you've played and how they went)
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  army_id uuid not null references public.armies(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_owner_idx on public.games(owner);
alter table public.games enable row level security;
drop policy if exists "Your own games" on public.games;
create policy "Your own games" on public.games for all to authenticated using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from public.armies a where a.id = army_id and a.owner = auth.uid()));

-- 8. Comments on shared armies
--    Anyone can read the comments on a shared army; logged-in painters can comment. You can delete your own
--    comments, and any comment on your own army. by_name and by_pic are the commenter's display name and
--    picture when they posted (never their email).
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  army_id uuid not null references public.armies(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  by_name text not null default '' check (char_length(by_name) <= 40),
  by_pic text not null default '' check (char_length(by_pic) <= 600),
  created_at timestamptz not null default now()
);
create index if not exists comments_army_idx on public.comments(army_id, created_at);
alter table public.comments enable row level security;
drop policy if exists "Read comments on shared armies and your own" on public.comments;
create policy "Read comments on shared armies and your own" on public.comments for select to anon, authenticated
  using (exists (select 1 from public.armies a where a.id = army_id and (a.public or a.owner = auth.uid())));
drop policy if exists "Comment as yourself on shared armies" on public.comments;
create policy "Comment as yourself on shared armies" on public.comments for insert to authenticated
  with check (owner = auth.uid() and exists (select 1 from public.armies a where a.id = army_id and (a.public or a.owner = auth.uid())));
drop policy if exists "Delete your comments, or any on your army" on public.comments;
create policy "Delete your comments, or any on your army" on public.comments for delete to authenticated
  using (owner = auth.uid() or exists (select 1 from public.armies a where a.id = army_id and a.owner = auth.uid()));

-- 9. War Ledger: battles against a friend
--    Tag a painter you follow as your opponent and they can see that battle, then add it to their own record.
alter table public.games add column if not exists opp_user uuid references auth.users(id) on delete set null;
create index if not exists games_opp_user_idx on public.games(opp_user) where opp_user is not null;
drop policy if exists "See battles you were tagged in" on public.games;
create policy "See battles you were tagged in" on public.games for select to authenticated using (opp_user = auth.uid());

-- 10. Your settings (projects, opponent notes, event sign-ups, paint levels…)
--     Kept in their own table rather than on the login, which Supabase copies into every sign-in token.
--     The site moves any settings saved on the login here the first time.
create table if not exists public.user_settings (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists "Your own settings" on public.user_settings;
create policy "Your own settings" on public.user_settings for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- 11. Names and pictures come from the account, not the browser
--     A comment's name and picture, and a shared army's "by" and "byPic", are filled in by the database from
--     the account (display name, else name, else the part of the email before @), so nobody can post as
--     someone else.
create or replace function public.player_name(uid uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), ''), 40) from auth.users u where u.id = uid
$$;
create or replace function public.player_pic(uid uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select left(coalesce(u.raw_user_meta_data->>'avatar_url', ''), 600) from auth.users u where u.id = uid
$$;
revoke all on function public.player_name(uuid) from public, anon, authenticated;
revoke all on function public.player_pic(uuid) from public, anon, authenticated;
create or replace function public.comment_author() returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  new.by_name := coalesce(public.player_name(new.owner), '');
  new.by_pic := coalesce(public.player_pic(new.owner), '');
  return new;
end $$;
drop trigger if exists comment_author on public.comments;
create trigger comment_author before insert or update on public.comments for each row execute function public.comment_author();
create or replace function public.army_author() returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  new.scheme := coalesce(new.scheme, '{}'::jsonb)
    || jsonb_build_object('by', coalesce(public.player_name(new.owner), ''), 'byPic', coalesce(public.player_pic(new.owner), ''));
  return new;
end $$;
drop trigger if exists army_author on public.armies;
create trigger army_author before insert or update on public.armies for each row execute function public.army_author();

-- 12. Tagging an opponent: only a player whose army you follow, or who tagged you in one of their battles
create or replace function public.check_opp_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.opp_user is null or (tg_op = 'UPDATE' and new.opp_user is not distinct from old.opp_user) then return new; end if;
  if exists (select 1 from public.army_follows f join public.armies a on a.id = f.army_id where f.user_id = new.owner and a.owner = new.opp_user)
     or exists (select 1 from public.games g where g.owner = new.opp_user and g.opp_user = new.owner) then
    return new;
  end if;
  raise exception 'You can only tag players whose armies you follow.';
end $$;
drop trigger if exists check_opp_user on public.games;
create trigger check_opp_user before insert or update on public.games for each row execute function public.check_opp_user();

-- 13. Likes on an army that isn't shared are only seen by its owner (and whoever gave them)
drop policy if exists "Logged-in painters see likes" on public.likes;
drop policy if exists "See likes on shared armies" on public.likes;
create policy "See likes on shared armies" on public.likes for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.armies a where a.id = army_id and (a.public or a.owner = auth.uid())));

-- 14. Like counts, counted in the database (a plain list of likes stops at 1,000 rows)
create or replace function public.like_counts(ids uuid[])
returns table(army_id uuid, n bigint) language sql stable security invoker set search_path = public as $$
  select l.army_id, count(*) from public.likes l where l.army_id = any(ids) group by l.army_id
$$;
grant execute on function public.like_counts(uuid[]) to authenticated;
