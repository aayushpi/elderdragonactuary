# Supabase backend + simple secure login

This project can use Supabase for:

- Email magic-link login (no passwords)
- Per-user cloud backup of game data

## 1) Create Supabase project

1. Create a project at https://supabase.com
2. In **Authentication → Providers**, enable **Email**.
3. In **Authentication → URL Configuration**, set your app URL(s), for example:
   - `http://localhost:5173`
   - your production URL

## 2) Create table + RLS policies

Run the migration in `supabase/migrations/20260225_create_game_snapshots.sql`.

Quick option: copy/paste this SQL into Supabase SQL editor:

```sql
create table if not exists public.game_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  games_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_snapshots enable row level security;

create policy "users can read own snapshot"
on public.game_snapshots
for select
using (auth.uid() = user_id);

create policy "users can insert own snapshot"
on public.game_snapshots
for insert
with check (auth.uid() = user_id);

create policy "users can update own snapshot"
on public.game_snapshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

You only need to run this once per Supabase project.

## 3) Add frontend env vars

Create `.env.local`:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Values are in Supabase **Project Settings → API**.

## 4) User flow in app

1. Open Settings → Secure Cloud Sync
2. Enter email and send magic link
3. Open link from email
4. Use:
   - **Push local → cloud** to upload current local games
   - **Pull cloud → local** to restore from cloud

## Security notes

- Data access is protected by Supabase Auth + RLS, not by a shared secret.
- Each user can access only rows where `user_id = auth.uid()`.
