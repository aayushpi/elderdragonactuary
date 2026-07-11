-- ─── Supabase Migration: Create decks table ──────────────────────────────
-- Stores a user's imported decklists, keyed by commander. Used to seed the
-- fast-mana and wincon pickers with the actual cards in a deck.

-- Decks table
create table if not exists public.decks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  commander_name   text not null,
  partner_name     text,
  color_identity   text[],
  source           text not null check (source in ('moxfield', 'archidekt', 'text')),
  source_url       text,
  cards            jsonb not null default '[]'::jsonb,
  fast_mana_cards  text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-populate user_id from the authenticated user on insert
alter table public.decks
  alter column user_id set default auth.uid();

-- Index on user_id for fast per-user queries
create index if not exists idx_decks_user_id on public.decks(user_id);

-- Index on commander_name for matching a played commander to a deck
create index if not exists idx_decks_commander_name on public.decks(commander_name);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.decks enable row level security;

create policy "Users can view own decks"
  on public.decks for select
  using (auth.uid() = user_id);

create policy "Users can insert own decks"
  on public.decks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own decks"
  on public.decks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own decks"
  on public.decks for delete
  using (auth.uid() = user_id);

-- ─── Auto-update updated_at timestamp ────────────────────────────────────────
-- Reuses public.handle_updated_at() defined in 001_create_games.sql

create trigger on_decks_updated
  before update on public.decks
  for each row
  execute function public.handle_updated_at();
