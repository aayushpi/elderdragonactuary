-- ─── Migration 007: Community commander stats materialized view ──────────────
-- Aggregates commander performance across ALL users without exposing any
-- individual user's game records (no user_id in output).
--
-- Privacy guarantees:
--   • Only commanders with >= 3 appearances are included.
--   • No user_id, displayName, or game_id is surfaced.
--   • Refresh is done by a scheduled job, not in response to individual writes.

create materialized view if not exists public.community_commander_stats as
select
  p.value ->> 'commanderName'                          as commander_name,
  p.value ->> 'commanderManaCost'                      as mana_cost,
  p.value -> 'commanderColorIdentity'                  as color_identity,
  count(*)                                             as total_appearances,
  sum(
    case when g.winner_player_id = p.value ->> 'id'
    then 1 else 0 end
  )                                                    as total_wins,
  round(
    sum(case when g.winner_player_id = p.value ->> 'id' then 1 else 0 end)::numeric
    / nullif(count(*), 0),
    4
  )                                                    as win_rate,
  round(avg(g.win_turn), 2)                            as avg_win_turn,
  count(distinct g.user_id)                            as unique_pilots
from public.games g,
     jsonb_array_elements(g.players) as p(value)
group by 1, 2, 3
having count(*) >= 3
with data;

create unique index if not exists idx_community_commander_stats_name
  on public.community_commander_stats (commander_name);

-- Grant read access to authenticated users (no write access).
grant select on public.community_commander_stats to authenticated;

-- ─── Scheduled refresh ───────────────────────────────────────────────────────
-- Uncomment after enabling the pg_cron extension (requires Supabase Pro).
--
-- select cron.schedule(
--   'refresh-community-commander-stats',
--   '0 */6 * * *',
--   'refresh materialized view concurrently public.community_commander_stats'
-- );
--
-- On free tier: trigger a refresh via Supabase Edge Function on a schedule,
-- or call manually after significant data import events.
