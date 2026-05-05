# Player Statistics Strategy

## Current State

All statistics today are computed entirely **client-side** in `src/lib/stats.ts`, reading from a
single `public.games` table via `fetchGames()`. Row Level Security (RLS) restricts every user to
their own rows, which means cross-user community data is architecturally impossible today.

### What already exists (per-user, client-side)
| Metric | Location |
|---|---|
| Overall / seat / bracket win rate | `computeStats()` |
| Fast mana correlation (with / against) | `computeStats()` |
| Win rate by commander + key cards | `computeStats()` |
| Win rate by color identity | `computeStats()` |
| Average win turn | `computeStats()` |
| Top win conditions | `computeStats()` |
| Win streak | `WinStreakCard` |
| Pod ELO (recurring group ELO) | `computePodElo()` |
| Commander ELO | `computeCommanderElo()` |

### Schema (single source of truth)

```sql
public.games (
  id               uuid PK,
  user_id          uuid FK → auth.users,
  played_at        timestamptz,
  win_turn         integer,
  winner_player_id text,          -- player UUID inside the JSONB array
  notes            text,
  win_conditions   text[],
  key_wincon_cards text[],
  bracket          integer 1–5,
  players          jsonb,         -- array of DbPlayer objects (see below)
  created_at       timestamptz,
  updated_at       timestamptz
)

-- players JSONB element shape:
{
  id:                     string,
  is_me:                  boolean,
  commanderName:          string,
  commanderImageUri?:     string,
  commanderColorIdentity?: string[],   -- ["W","U","B","R","G"] subset
  commanderManaCost?:     string,
  commanderTypeLine?:     string,
  partnerName?:           string,
  knockoutTurn?:          number,
  seatPosition:           1|2|3|4|5|6,
  displayName?:           string,
  fastMana: { hasFastMana: boolean, cards: string[] }
}
```

---

## Goals

1. **Offload heavy aggregations to Postgres** — eliminate client-side O(n·games) loops for stats
   that can be pre-computed, reducing Time-to-Interactive on the Stats page.
2. **Enable community / cross-user stats** — surfacing meta-level insights (most popular
   commanders, win rate distribution, format trends) without exposing individual user records.
3. **Add missing per-user dimensions** — opponent commander tracking, nemesis detection,
   head-to-head records within named pods.
4. **Keep RLS intact** — no user ever reads another user's raw game rows.

---

## Data Model Changes

### Migration 006 — JSONB helper indexes

```sql
-- Fast lookup of any game by commander name (inside the JSONB array)
create index if not exists idx_games_players_commander
  on public.games using gin (players jsonb_path_ops);

-- Fast range queries for date-bucketed rollups
create index if not exists idx_games_played_at_user
  on public.games (user_id, played_at desc);
```

### Migration 007 — Community stats materialized view

RLS prevents a plain view from reading cross-user rows. The solution is a
**security-definer function** that runs as the table owner and returns only
pre-aggregated rows — no individual user data is ever surfaced.

```sql
-- Aggregate commander stats across all users (no user_id exposed)
create materialized view public.community_commander_stats as
select
  p.value ->> 'commanderName'                        as commander_name,
  p.value ->> 'commanderManaCost'                    as mana_cost,
  p.value -> 'commanderColorIdentity'                as color_identity,
  count(*)                                           as total_appearances,
  sum(case when g.winner_player_id = p.value ->> 'id' then 1 else 0 end)
                                                     as total_wins,
  round(
    sum(case when g.winner_player_id = p.value ->> 'id' then 1 else 0 end)::numeric
    / count(*), 4
  )                                                  as win_rate,
  round(avg(g.win_turn), 2)                          as avg_win_turn,
  count(distinct g.user_id)                          as unique_pilots
from public.games g,
     jsonb_array_elements(g.players) as p
group by 1, 2, 3
having count(*) >= 3   -- suppress commanders with < 3 appearances (privacy + noise)
with data;

create unique index on public.community_commander_stats (commander_name);

-- Refresh on a schedule (see Deployment section)
```

### Migration 008 — Per-user DB-side aggregation function

Replaces the heaviest client-side loops with a single RPC call:

```sql
create or replace function public.get_my_stats()
returns jsonb
language sql
security invoker   -- runs as the calling user; RLS applies automatically
stable
as $$
  select jsonb_build_object(
    'gamesPlayed',   count(*),
    'avgWinTurn',    round(avg(case when g.winner_player_id = me.value ->> 'id'
                               then g.win_turn end), 2),
    'topCommanders', (
      select jsonb_agg(row_to_json(c)) from (
        select
          p.value ->> 'commanderName'  as name,
          count(*)                     as games,
          sum(case when g2.winner_player_id = p.value ->> 'id' then 1 else 0 end) as wins
        from public.games g2,
             jsonb_array_elements(g2.players) p
        where g2.user_id = auth.uid()
          and (p.value ->> 'is_me')::boolean
        group by 1
        order by wins desc, games desc
        limit 10
      ) c
    )
  )
  from public.games g,
       jsonb_array_elements(g.players) me
  where g.user_id = auth.uid()
    and (me.value ->> 'is_me')::boolean;
$$;
```

### Migration 009 — Opponent tracking view (per-user)

```sql
-- Which commanders has the logged-in user faced, and what is their record against each?
create or replace view public.my_opponent_stats as
select
  opp.value ->> 'commanderName'   as opponent_commander,
  count(*)                        as games_faced,
  sum(case when g.winner_player_id = me.value ->> 'id' then 1 else 0 end)
                                  as my_wins,
  sum(case when g.winner_player_id = opp.value ->> 'id' then 1 else 0 end)
                                  as opp_wins
from public.games g,
     jsonb_array_elements(g.players) me,
     jsonb_array_elements(g.players) opp
where g.user_id = auth.uid()
  and (me.value  ->> 'is_me')::boolean
  and not (opp.value ->> 'is_me')::boolean
group by 1
order by games_faced desc;
```

---

## Key Metrics & Calculations

### Per-user metrics (already exist — move to DB)

| Metric | Calculation | Priority |
|---|---|---|
| Overall win rate | `wins / games` | Medium — already client-side |
| Seat win rate | Filter by `seatPosition`, compute win rate | Low — small n |
| Commander win rate | Group by `commanderName` where `is_me` | High — O(n) loop today |
| Avg win turn | `avg(win_turn)` filtered to my wins | High |
| Fast mana correlation | Filter `fastMana.hasFastMana`, compute lift | Medium |

### New per-user metrics (not yet built)

| Metric | Calculation |
|---|---|
| Nemesis commander | Opponent commander with highest win rate against me (`my_opponent_stats` view) |
| Revenge rate | % of games I won after losing to the same commander previously |
| Pod size distribution | `count(players)` bucketed by 2/3/4/5 |
| Knockout turn distribution | `avg(knockoutTurn)` per player, histogram |
| Win condition diversity score | Unique win conditions used / total wins |
| Recent form (last 10) | Ordered W/L string from last 10 `is_me` games |

### Community metrics (new — require materialized view)

| Metric | Source | Privacy guarantee |
|---|---|---|
| Most popular commander | `community_commander_stats` | Aggregated, ≥3 appearances |
| Highest win rate (min 5 games) | `community_commander_stats WHERE total_appearances >= 5` | Same |
| Win turn distribution | Aggregate `win_turn` histogram across all games | No user_id in output |
| Fast mana meta-share | `% of games with any fastMana.hasFastMana = true` | Aggregate only |
| Bracket distribution | Count by bracket | Aggregate only |
| Commander color meta-share | Group by `colorIdentity` | Aggregate only |

---

## Aggregation & Rollups

### Refresh strategy for `community_commander_stats`

| Approach | Latency | Complexity |
|---|---|---|
| On-write trigger (Postgres) | Real-time | High — refresh on every insert/update/delete |
| Supabase Edge Function (cron) | Up to 24h stale | Low — one scheduled job |
| **Recommended: pg_cron every 6h** | ~6h stale | Low — single SQL line |

```sql
-- Requires pg_cron extension (available on Supabase Pro)
select cron.schedule(
  'refresh-community-stats',
  '0 */6 * * *',   -- every 6 hours
  'refresh materialized view concurrently public.community_commander_stats'
);
```

For free-tier Supabase (no pg_cron), use a Supabase Edge Function triggered by the
Supabase cron scheduler via the dashboard, or trigger a refresh from the app on the
first stats page load after a configurable staleness threshold.

---

## API Surface

### Existing (keep)
- `fetchGames()` — full game list for the current user, used by client-side stats

### New RPC calls to add to `supabaseStorage.ts`

```typescript
// Replaces the heaviest computeStats() loops
export async function fetchMyStatsFromDb(): Promise<DbStats> {
  const { data, error } = await supabase.rpc('get_my_stats')
  if (error) throw error
  return data as DbStats
}

// Opponent tracking
export async function fetchOpponentStats(): Promise<OpponentStat[]> {
  const { data, error } = await supabase.from('my_opponent_stats').select('*')
  if (error) throw error
  return data as OpponentStat[]
}

// Community meta (public, no auth required)
export async function fetchCommunityCommanderStats(): Promise<CommunityCommanderStat[]> {
  const { data, error } = await supabase
    .from('community_commander_stats')
    .select('*')
    .order('total_appearances', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as CommunityCommanderStat[]
}
```

---

## Dashboard / UI Plan

### Phase 1 additions to `StatsPage`
- **Nemesis card** — opponent commander with the worst record against me; replace the
  "Archnemesis color" card with a specific commander + art
- **Pod size card** — pie/bar of 2/3/4/5-player game distribution
- **Recent form strip** — last 10 results as colored W/L pills (like cricket form guide)

### Phase 2 — new `MetaPage` route (`/meta`)
Sourced from `community_commander_stats`, accessible to all logged-in users:
- **Top commanders by appearances** — bar chart, filterable by color identity
- **Top commanders by win rate** (min 5 games) — ranked list with art
- **Win turn distribution** — histogram (x = turn number, y = % of games won that turn)
- **Fast mana meta-share** — single percentage with trend arrow

### Phase 3 — enhanced `StatsPage` sections
- **Head-to-head breakdown** — per named pod, expandable table (W/L vs each opponent)
- **Commander matchup matrix** — which of my commanders beats which opponent commanders

---

## Data Quality & Governance

### Existing gaps to address

| Issue | Impact | Fix |
|---|---|---|
| `winner_player_id` is a player UUID from the JSONB array, not a stable identifier | Makes cross-game winner joins fragile | Add `winner_commander_name` as a denormalized column in a new migration |
| `displayName` is optional — pod ELO silently drops games with unnamed players | Undercounts pod history | Prompt to fill names before saving; validate in `insertGame()` |
| `knockoutTurn` is optional | Knockout histograms have missing data | Make it required in the log-game form for non-winners |
| JSONB `players` array has no schema enforcement in Postgres | Bad data can slip in | Add a `CHECK` constraint or use a DB trigger to validate shape |

### Validation additions

```sql
-- Ensure players is a non-empty array
alter table public.games
  add constraint games_players_nonempty
  check (jsonb_array_length(players) >= 2);

-- Ensure bracket is set when saving (nullable by design, enforce in app layer)
-- No DB constraint — bracket is intentionally optional for casual games
```

---

## Security & Privacy

- **RLS never changes** — `public.games` stays user-scoped. No policy modifications.
- **`community_commander_stats`**: the materialized view is populated by a
  `security definer` function (owner = `postgres`). Grant only `SELECT` to `authenticated`:
  ```sql
  grant select on public.community_commander_stats to authenticated;
  ```
- **Minimum appearance threshold** (≥3) prevents reverse-engineering individual users'
  data from community aggregates when the user base is small.
- **`my_opponent_stats` view** uses `security invoker` — RLS applies automatically;
  users see only their own opponent data.
- **No PII in aggregates** — `user_id` is never included in any community-facing output.
  `displayName` (free-text) is excluded from all community views.

---

## Deployment Plan

### Branch: `feat/player-stats`

```
feat/player-stats
├── supabase/migrations/
│   ├── 006_jsonb_indexes.sql
│   ├── 007_community_commander_stats.sql
│   ├── 008_get_my_stats_rpc.sql
│   └── 009_opponent_stats_view.sql
├── src/lib/
│   ├── supabaseStorage.ts        (add fetchMyStatsFromDb, fetchOpponentStats,
│   │                              fetchCommunityCommanderStats)
│   └── stats.ts                  (add nemesis, pod-size, recent-form helpers)
├── src/types/
│   └── database.ts               (add DbStats, OpponentStat, CommunityCommanderStat)
├── src/hooks/
│   └── useCommunityStats.ts      (new hook, caches community data with SWR-style TTL)
└── src/pages/
    ├── StatsPage.tsx             (add Nemesis card, pod size, recent form)
    └── MetaPage.tsx              (new community meta page)
```

### Deployment steps

1. **Apply migrations** in order (006 → 007 → 008 → 009) via Supabase SQL editor or
   `supabase db push` after linking the project.
2. **Seed the materialized view** immediately after migration 007:
   `refresh materialized view public.community_commander_stats;`
3. **Deploy Edge Function** (or configure pg_cron) for the 6-hour refresh schedule.
4. **Ship frontend changes** — `MetaPage` can be feature-flagged behind a nav item
   until community data is non-trivial (suggested threshold: ≥50 total games in the view).

---

## Roadmap

| Milestone | Scope | Estimate |
|---|---|---|
| **M1 — DB foundations** | Migrations 006–009; new type definitions; RPC wrappers in `supabaseStorage.ts` | 1–2 days |
| **M2 — Per-user enhancements** | Nemesis card; pod size distribution; recent form strip; opponent stats table on StatsPage | 2–3 days |
| **M3 — Community meta page** | `MetaPage` route with commander rankings, win turn histogram, fast mana share | 2–3 days |
| **M4 — Data quality** | `knockoutTurn` required for non-winners in log form; JSONB `CHECK` constraint; denormalized `winner_commander_name` column | 1 day |
| **M5 — Head-to-head & matchup matrix** | Per-pod W/L table; commander matchup breakdown (Phase 3) | 3–4 days |

**Total estimate: ~2 weeks** for M1–M4; M5 is a stretch goal dependent on pod data volume.

### Dependencies

- M1 must ship before M2 and M3.
- M3 requires at least ~50 community games in `community_commander_stats` to be
  meaningful — can be developed against synthetic data and soft-launched.
- M4 (data quality) is independent and can run in parallel with M2/M3.
- pg_cron requires Supabase Pro; on free tier, implement the refresh via an Edge Function.
