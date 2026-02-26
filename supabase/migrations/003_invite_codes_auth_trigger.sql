-- Invite code enforcement at Supabase auth layer.
-- New signups must provide raw_user_meta_data.invite_code that matches
-- an active code in public.invite_codes.

create table if not exists public.invite_codes (
  code text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed Magic meme invite codes (idempotent)
insert into public.invite_codes (code, active)
values
  ('BOLT THE BIRD', true),
  ('DIES TO DOOM BLADE', true),
  ('MANA CRYPT FLIP', true),
  ('DRAW GO', true),
  ('SCOOP AT SORCERY SPEED', true)
on conflict (code) do nothing;

-- Optional RLS (defaults deny all anon/authenticated reads)
alter table public.invite_codes enable row level security;

create or replace function public.normalize_invite_code(input text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(trim(coalesce(input, '')), '\\s+', ' ', 'g'))
$$;

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

drop trigger if exists on_auth_user_created_require_invite_code on auth.users;

create trigger on_auth_user_created_require_invite_code
before insert on auth.users
for each row
execute function public.enforce_signup_invite_code();
