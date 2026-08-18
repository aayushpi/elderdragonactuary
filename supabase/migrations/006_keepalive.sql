-- ─── Supabase Migration: Keepalive ping ─────────────────────────────────────
-- Free-tier projects are paused after 7 days with no activity. A scheduled job
-- calls public.keepalive_ping() to generate a real Postgres write every few
-- days. Hitting the REST root is NOT enough — PostgREST can answer that without
-- touching the database.

-- Single-row table recording the most recent ping.
create table if not exists public.keepalive (
  id            smallint primary key default 1,
  last_ping_at  timestamptz not null default now(),
  source        text not null default 'seed',
  ping_count    bigint not null default 0,
  constraint keepalive_single_row check (id = 1)
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

-- RLS on with no policies: anon/authenticated cannot touch the table directly.
-- All access goes through the security definer function below.
alter table public.keepalive enable row level security;

-- Records the ping and returns the PREVIOUS ping time so the caller can detect
-- that the schedule silently stopped running.
create or replace function public.keepalive_ping(p_source text default null)
returns table (
  pinged_at          timestamptz,
  previous_pinged_at timestamptz,
  total_pings        bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  prev timestamptz;
begin
  select k.last_ping_at into prev from public.keepalive k where k.id = 1;

  return query
    update public.keepalive k
       set last_ping_at = now(),
           source       = coalesce(p_source, 'unknown'),
           ping_count   = k.ping_count + 1
     where k.id = 1
    returning k.last_ping_at, prev, k.ping_count;
end;
$$;

revoke all on function public.keepalive_ping(text) from public;
grant execute on function public.keepalive_ping(text) to anon, authenticated;
