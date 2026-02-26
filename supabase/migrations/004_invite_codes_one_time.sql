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
  consumed_code text;
begin
  normalized_code := public.normalize_invite_code(new.raw_user_meta_data ->> 'invite_code');

  if normalized_code = '' then
    raise exception 'Invite code is required.';
  end if;

  with matched as (
    select ic.code
    from public.invite_codes ic
    where ic.active = true
      and public.normalize_invite_code(ic.code) = normalized_code
      and ic.remaining_uses > 0
    limit 1
    for update
  ), updated as (
    update public.invite_codes ic
    set remaining_uses = ic.remaining_uses - 1
    from matched
    where ic.code = matched.code
    returning ic.code
  )
  select code into consumed_code from updated;

  if consumed_code is null then
    if exists (
      select 1
      from public.invite_codes ic
      where ic.active = true
        and public.normalize_invite_code(ic.code) = normalized_code
    ) then
      raise exception 'Invite code has already been used.';
    end if;

    raise exception 'Invalid invite code.';
  end if;

  return new;
end;
$$;
