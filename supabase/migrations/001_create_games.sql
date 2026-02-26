-- ─── Supabase Migration: Create games table ──────────────────────────────
-- Run this in the Supabase SQL editor or as a migration.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Games table
create table if not exists public.games (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  played_at     timestamptz not null,
  win_turn      integer not null,
  winner_player_id text not null,
  notes         text,
  win_conditions text[],
  key_wincon_cards text[],
  bracket       integer check (bracket is null or (bracket >= 1 and bracket <= 5)),
  players       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index on user_id for fast per-user queries
create index if not exists idx_games_user_id on public.games(user_id);

-- Index on played_at for ordering
create index if not exists idx_games_played_at on public.games(played_at desc);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.games enable row level security;

-- Users can only see their own games
create policy "Users can view own games"
  on public.games for select
  using (auth.uid() = user_id);

-- Users can insert their own games
create policy "Users can insert own games"
  on public.games for insert
  with check (auth.uid() = user_id);

-- Users can update their own games
create policy "Users can update own games"
  on public.games for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own games
create policy "Users can delete own games"
  on public.games for delete
  using (auth.uid() = user_id);

-- ─── Auto-update updated_at timestamp ────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_games_updated
  before update on public.games
  for each row
  execute function public.handle_updated_at();
