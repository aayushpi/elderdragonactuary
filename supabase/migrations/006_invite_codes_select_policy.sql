-- Allow selecting invite codes that are unassigned (created_by IS NULL)
-- so clients can claim them and attach to their account.

drop policy if exists "invite_codes_select_own" on public.invite_codes;

create policy if not exists "invite_codes_select_available_or_own" on public.invite_codes
  for select
  using (created_by is null or created_by = auth.uid());
