-- Ensure user_id auto-populates from authenticated user for inserts.
-- Run this once if your project already has the games table.

alter table public.games
  alter column user_id set default auth.uid();
