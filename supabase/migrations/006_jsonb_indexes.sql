-- ─── Migration 006: JSONB indexes for player stats queries ──────────────────
-- GIN index enables fast jsonb_path_ops queries on the players array
-- (commander name lookups, is_me filtering, color identity filtering).

create index if not exists idx_games_players_gin
  on public.games using gin (players jsonb_path_ops);

-- Composite index for per-user chronological queries used by stats rollups.
create index if not exists idx_games_user_played_at
  on public.games (user_id, played_at desc);
