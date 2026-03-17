alter table public.games
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists duration_ms bigint,
  add column if not exists starting_player_id text,
  add column if not exists live_summary jsonb;
