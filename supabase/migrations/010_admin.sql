-- ─── Migration 010: Admin god-mode ───────────────────────────────────────────
-- Admin users are added manually via the Supabase SQL editor:
--   insert into public.admin_users (user_id)
--   values ('<your-auth-user-uuid>');

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ─── is_admin() ──────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- ─── admin_get_player_list() ─────────────────────────────────────────────────
-- Returns one row per auth user with aggregate game stats.
-- Checks admin access before returning any data.

create or replace function public.admin_get_player_list()
returns table(
  user_id          uuid,
  email            text,
  games_logged     bigint,
  first_game_at    timestamptz,
  last_game_at     timestamptz,
  commanders_played text[]
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    u.id                            as user_id,
    u.email::text                   as email,
    coalesce(s.games_logged, 0)     as games_logged,
    s.first_game_at,
    s.last_game_at,
    s.commanders_played
  from auth.users u
  left join lateral (
    select
      count(g.id)::bigint           as games_logged,
      min(g.played_at)              as first_game_at,
      max(g.played_at)              as last_game_at,
      array_agg(distinct p.value ->> 'commanderName')
        filter (where (p.value ->> 'is_me')::boolean = true)
                                    as commanders_played
    from public.games g,
         jsonb_array_elements(g.players) p(value)
    where g.user_id = u.id
  ) s on true
  order by s.games_logged desc nulls last, u.email;
end;
$$;

grant execute on function public.admin_get_player_list() to authenticated;

-- ─── admin_get_all_games() ───────────────────────────────────────────────────
-- Returns every game across all users, newest first.

create or replace function public.admin_get_all_games()
returns table(
  id               uuid,
  user_email       text,
  played_at        timestamptz,
  win_turn         integer,
  winner_player_id text,
  bracket          integer,
  win_conditions   text[],
  key_wincon_cards text[],
  notes            text,
  players          jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    g.id,
    u.email::text   as user_email,
    g.played_at,
    g.win_turn,
    g.winner_player_id,
    g.bracket,
    g.win_conditions,
    g.key_wincon_cards,
    g.notes,
    g.players
  from public.games g
  join auth.users u on u.id = g.user_id
  order by g.played_at desc;
end;
$$;

grant execute on function public.admin_get_all_games() to authenticated;
