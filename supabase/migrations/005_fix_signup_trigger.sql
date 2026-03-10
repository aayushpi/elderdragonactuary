-- Fix signup: two issues caused "Database error saving new user" on every signup.
--
-- Issue 1 (migration 004): The invite code trigger used FOR UPDATE + CTE UPDATE
-- inside a BEFORE INSERT trigger on auth.users, which fails because RLS is
-- enabled on invite_codes with no UPDATE policy. Reverted to simple validation.
--
-- Issue 2 (profiles trigger): create_profile_on_user_created() was NOT SECURITY
-- DEFINER, so the INSERT into profiles was blocked by RLS (auth.uid() is not set
-- during the auth trigger). Fixed by adding SECURITY DEFINER.

-- 1. Fix invite code trigger: simple validation, no UPDATE/FOR UPDATE
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

-- 2. Fix profile creation trigger: add SECURITY DEFINER to bypass RLS
create or replace function public.create_profile_on_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
