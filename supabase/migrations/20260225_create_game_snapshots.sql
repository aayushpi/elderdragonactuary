create table if not exists public.game_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  games_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_snapshots'
      and policyname = 'users can read own snapshot'
  ) then
    create policy "users can read own snapshot"
      on public.game_snapshots
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_snapshots'
      and policyname = 'users can insert own snapshot'
  ) then
    create policy "users can insert own snapshot"
      on public.game_snapshots
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_snapshots'
      and policyname = 'users can update own snapshot'
  ) then
    create policy "users can update own snapshot"
      on public.game_snapshots
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
