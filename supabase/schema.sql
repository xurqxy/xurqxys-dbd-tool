-- Xurqxys DBD Tool: online features
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run again.
--
-- Security model: the app only holds the public "anon" key. Nobody can write to the tables directly;
-- every write goes through the functions below, which check who is calling and cap how fast numbers can grow.

-- ───────────── Profiles + leaderboard ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  spins bigint not null default 0,
  achievements int not null default 0,
  days_active int not null default 0,
  show_on_leaderboard boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Leaderboard is public" on public.profiles;
create policy "Leaderboard is public" on public.profiles
  for select using (show_on_leaderboard or auth.uid() = id);
-- No insert/update/delete policies: writes only happen through the functions below.

-- Upload your own progress. Numbers can only go up, and only at a human pace:
-- at most 1 spin per second and 1 active day per day since your last upload.
create or replace function public.submit_progress(p_spins bigint, p_achievements int, p_days int, p_name text, p_avatar text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prev public.profiles;
  secs bigint;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  select * into prev from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id, display_name, avatar_url, spins, achievements, days_active)
    values (uid, left(coalesce(nullif(trim(p_name), ''), 'Player'), 32), left(p_avatar, 300),
            least(greatest(p_spins, 0), 5000), least(greatest(p_achievements, 0), 100), least(greatest(p_days, 0), 60))
    returning * into prev;
    return prev;
  end if;
  secs := greatest(60, extract(epoch from (now() - prev.updated_at))::bigint);
  update public.profiles set
    display_name = left(coalesce(nullif(trim(p_name), ''), display_name), 32),
    avatar_url = coalesce(left(p_avatar, 300), avatar_url),
    spins = greatest(spins, least(p_spins, spins + secs)),
    achievements = greatest(achievements, least(p_achievements, 100)),
    days_active = greatest(days_active, least(p_days, days_active + 1 + secs / 86400)),
    updated_at = now()
  where id = uid
  returning * into prev;
  return prev;
end $$;

create or replace function public.set_leaderboard_visibility(p_visible boolean)
returns void
language sql security definer set search_path = public as $$
  update public.profiles set show_on_leaderboard = p_visible where id = auth.uid();
$$;

-- Removes the profile and the login itself.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- ───────────── Anonymous community stats ─────────────
create table if not exists public.spin_counts (
  day date not null default current_date,
  role text not null check (role in ('killer', 'survivor')),
  character_id text not null check (char_length(character_id) <= 40),
  mode text not null default 'standard' check (char_length(mode) <= 20),
  spins int not null default 0,
  primary key (day, role, character_id, mode)
);
alter table public.spin_counts enable row level security;
drop policy if exists "Community stats are public" on public.spin_counts;
create policy "Community stats are public" on public.spin_counts for select using (true);

-- The app sends spins in small batches. Each call adds at most 100 rows of at most 20 spins.
create or replace function public.record_spins(p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  n int := 0;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    n := n + 1;
    exit when n > 100;
    continue when (it->>'role') not in ('killer', 'survivor') or coalesce(it->>'character', '') = '';
    insert into public.spin_counts (day, role, character_id, mode, spins)
    values (current_date, it->>'role', left(it->>'character', 40), left(coalesce(it->>'mode', 'standard'), 20),
            least(greatest(coalesce((it->>'count')::int, 1), 1), 20))
    on conflict (day, role, character_id, mode) do update set spins = public.spin_counts.spins + excluded.spins;
  end loop;
end $$;

create or replace function public.community_top(p_role text, p_days int default 7)
returns table (character_id text, spins bigint)
language sql stable security definer set search_path = public as $$
  select character_id, sum(spins)::bigint
  from public.spin_counts
  where role = p_role and day > current_date - least(greatest(p_days, 1), 365)
  group by character_id order by 2 desc limit 15;
$$;

create or replace function public.community_modes(p_days int default 7)
returns table (mode text, spins bigint)
language sql stable security definer set search_path = public as $$
  select mode, sum(spins)::bigint
  from public.spin_counts
  where day > current_date - least(greatest(p_days, 1), 365)
  group by mode order by 2 desc;
$$;

-- ───────────── Permissions ─────────────
revoke all on function public.submit_progress(bigint, int, int, text, text) from public, anon;
revoke all on function public.set_leaderboard_visibility(boolean) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.submit_progress(bigint, int, int, text, text) to authenticated;
grant execute on function public.set_leaderboard_visibility(boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.record_spins(jsonb) to anon, authenticated;
grant execute on function public.community_top(text, int) to anon, authenticated;
grant execute on function public.community_modes(int) to anon, authenticated;
grant select (display_name, avatar_url, spins, achievements, days_active, show_on_leaderboard, id) on public.profiles to anon, authenticated;
