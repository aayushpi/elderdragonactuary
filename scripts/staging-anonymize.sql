-- Anonymize production PII after it has been copied into the eda-staging project.
-- Idempotent: safe to run repeatedly. Run via sync-staging-data.sh, or directly:
--   psql "$STAGING_DB_URL" -v keep_emails='you@example.com,demo@example.com' -f scripts/staging-anonymize.sql
--
-- :keep_emails is a comma-separated allowlist of auth emails to preserve untouched
-- (your real staging login accounts, e.g. the demo account). Everything else is scrubbed.

\set ON_ERROR_STOP on

begin;

-- 1. auth.users: replace real emails with deterministic, non-routable staging addresses.
--    Skips the allowlist and anything already anonymized so it stays idempotent.
update auth.users
set
  email = 'user+' || id || '@staging.local',
  phone = null,
  raw_user_meta_data = (coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'full_name' - 'name' - 'email' - 'avatar_url' - 'picture'),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
where email is not null
  and email not like '%@staging.local'
  and (
    nullif(:'keep_emails', '') is null
    or lower(email) <> all (string_to_array(lower(:'keep_emails'), ','))
  );

-- 2. games.players[].displayName: deterministic per-name fake so the SAME person maps
--    to the SAME fake across every game (preserves pod / commander ELO grouping, which
--    is keyed on displayName). Guard skips already-anonymized names for idempotency.
update public.games g
set players = sub.p
from (
  select g2.id,
    jsonb_agg(
      case
        when e ? 'displayName'
          and (e->>'displayName') is not null
          and (e->>'displayName') !~ '^Player [0-9a-f]{6}$'
        then jsonb_set(e, '{displayName}',
               to_jsonb('Player ' || substr(md5(e->>'displayName'), 1, 6)))
        else e
      end
      order by ord
    ) as p
  from public.games g2,
       jsonb_array_elements(g2.players) with ordinality as t(e, ord)
  group by g2.id
) sub
where g.id = sub.id;

-- 3. games.notes: free-text may contain anything. Redact while preserving the
--    "has notes" signal so notes-rendering UI still has something to show.
update public.games
set notes = '[redacted for staging]'
where notes is not null
  and notes <> '[redacted for staging]';

-- 4. invite_codes are signup secrets. Staging is private, so they are copied as-is.
--    Uncomment to deactivate every copied code instead:
-- update public.invite_codes set active = false, remaining_uses = 0;

commit;

\echo 'Anonymization complete.'
