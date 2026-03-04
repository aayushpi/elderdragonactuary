-- Add owner column to invite_codes and a policy allowing users to insert their own codes

alter table public.invite_codes
  add column if not exists created_by uuid references auth.users on delete set null default auth.uid();

-- Allow authenticated users to insert invite codes where created_by matches their auth.uid()
alter table public.invite_codes enable row level security;

create policy if not exists "invite_codes_insert_own" on public.invite_codes
  for insert
  with check (created_by = auth.uid());

-- Optionally allow users to select their own invite codes
create policy if not exists "invite_codes_select_own" on public.invite_codes
  for select
  using (created_by = auth.uid());
