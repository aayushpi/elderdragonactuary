-- Make invite codes one-time use.
-- Existing invite codes become single-use by default (remaining_uses = 1).

alter table public.invite_codes
  add column if not exists remaining_uses integer not null default 1
  check (remaining_uses >= 0);

create or replace function public.enforce_signup_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_code text;
begin
  normalized_code := public.normalize_invite_code(new.raw_user_meta_data ->> 'invite_code');

  if normalized_code = '' then
    raise exception 'Invite code is required.';
  end if;

  -- Accept any matching active invite code; do not enforce or decrement remaining_uses here.
  if not exists (
    select 1
    from public.invite_codes ic
    where ic.active = true
      and public.normalize_invite_code(ic.code) = normalized_code
  ) then
    raise exception 'Invalid invite code.';
  end if;

  return new;
end;
$$;
