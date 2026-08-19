-- ─── Supabase Migration: Admin usage dashboard ──────────────────────────────
-- Per-account usage reporting for the in-app /admin page.
--
-- RLS confines every account to its own games, which is exactly right for the
-- app and useless for an operator who needs to see the whole roster. So the
-- reporting functions below are `security definer`, read across all rows, and
-- gate themselves on membership of public.admins. Anything that reaches
-- auth.users must go through one of these — the table itself is never exposed.

-- ─── Admin roster ───────────────────────────────────────────────────────────

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  added_at   timestamptz not null default now(),
  note       text
);

-- RLS on with no policies: anon/authenticated cannot read or write this table
-- directly, so an admin can never be added from the client. Membership is
-- granted from the SQL editor only.
alter table public.admins enable row level security;

-- ─── Bootstrap ──────────────────────────────────────────────────────────────

-- Which email addresses should become admins. Kept as a table rather than a
-- literal inside the seed so that granting admin later is one insert here,
-- and so the backfill and the signup trigger below share a single source of
-- truth about who qualifies.
create table if not exists public.admin_bootstrap_emails (
  email text primary key
);

alter table public.admin_bootstrap_emails enable row level security;

insert into public.admin_bootstrap_emails (email)
values ('aayush.iyer@gmail.com')
on conflict (email) do nothing;

-- Backfill: catches the case where the account already exists when this
-- migration runs.
insert into public.admins (user_id, note)
select u.id, 'bootstrap'
from auth.users u
join public.admin_bootstrap_emails b on lower(u.email) = lower(b.email)
on conflict (user_id) do nothing;

-- Forward cover: catches the opposite ordering, where the migration runs
-- first and the account is created afterwards. Without this, a bootstrap
-- email that signs up later would never gain access and the failure would be
-- silent — /admin would simply 404 forever.
create or replace function public.grant_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (
    select 1 from public.admin_bootstrap_emails b
    where lower(b.email) = lower(new.email)
  ) then
    insert into public.admins (user_id, note)
    values (new.id, 'bootstrap')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_grant_admin on auth.users;

create trigger on_auth_user_created_grant_admin
after insert on auth.users
for each row
execute function public.grant_admin_on_signup();

-- ─── Admin check ────────────────────────────────────────────────────────────

-- Callable from the client so the UI can decide whether to render the /admin
-- route at all. Returns false rather than raising for non-admins.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ─── Per-account usage ──────────────────────────────────────────────────────

create or replace function public.admin_account_usage()
returns table (
  user_id             uuid,
  email               text,
  signed_up_at        timestamptz,
  last_sign_in_at     timestamptz,
  email_confirmed_at  timestamptz,
  games_logged        bigint,
  first_game_at       timestamptz,
  last_game_at        timestamptz,
  last_logged_at      timestamptz,
  active_days         bigint,
  games_last_7d       bigint,
  games_last_30d      bigint,
  avg_pod_size        numeric,
  avg_win_turn        numeric,
  wins                bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required.'
      using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    count(g.id),
    min(g.played_at),
    max(g.played_at),
    -- When the row was actually written, as distinct from when the game was
    -- played: a backfilled season of games is not the same as active use.
    max(g.created_at),
    count(distinct g.played_at::date),
    count(*) filter (where g.played_at >= now() - interval '7 days'),
    count(*) filter (where g.played_at >= now() - interval '30 days'),
    round(avg(jsonb_array_length(g.players)), 2),
    round(avg(g.win_turn), 1),
    count(*) filter (
      where exists (
        select 1
        from jsonb_array_elements(g.players) p
        where coalesce((p ->> 'is_me')::boolean, false)
          and p ->> 'id' = g.winner_player_id
      )
    )
  from auth.users u
  left join public.games g on g.user_id = u.id
  group by u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at
  order by max(g.played_at) desc nulls last, u.created_at desc;
end;
$$;

revoke all on function public.admin_account_usage() from public;
grant execute on function public.admin_account_usage() to authenticated;

-- ─── Headline totals ────────────────────────────────────────────────────────

create or replace function public.admin_usage_totals()
returns table (
  total_accounts        bigint,
  accounts_with_games   bigint,
  active_7d             bigint,
  active_30d            bigint,
  new_accounts_30d      bigint,
  total_games           bigint,
  games_7d              bigint,
  games_30d             bigint,
  median_games_per_account numeric
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required.'
      using errcode = '42501';
  end if;

  return query
  with per_account as (
    select
      u.id,
      u.created_at,
      count(g.id) as games,
      max(g.played_at) as last_game_at
    from auth.users u
    left join public.games g on g.user_id = u.id
    group by u.id, u.created_at
  )
  select
    (select count(*) from per_account),
    (select count(*) from per_account where games > 0),
    (select count(*) from per_account where last_game_at >= now() - interval '7 days'),
    (select count(*) from per_account where last_game_at >= now() - interval '30 days'),
    (select count(*) from per_account where created_at >= now() - interval '30 days'),
    (select count(*) from public.games),
    (select count(*) from public.games where played_at >= now() - interval '7 days'),
    (select count(*) from public.games where played_at >= now() - interval '30 days'),
    -- Median, not mean: one power user with hundreds of games would otherwise
    -- make a mostly-idle roster look healthy.
    (select round(percentile_cont(0.5) within group (order by games)::numeric, 1) from per_account);
end;
$$;

revoke all on function public.admin_usage_totals() from public;
grant execute on function public.admin_usage_totals() to authenticated;
