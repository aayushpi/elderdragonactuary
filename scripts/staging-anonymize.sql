-- Replace production PII with realistic-looking MOCK PII after it has been copied into
-- the eda-staging project. Staging shows human names / emails that don't connect to any
-- real user, instead of opaque redactions, so the app looks like production.
-- Idempotent: safe to run repeatedly. Run via sync-staging-data.sh, or directly:
--   psql "$STAGING_DB_URL" -v keep_emails='you@example.com,demo@example.com' -f scripts/staging-anonymize.sql
--
-- :keep_emails is a comma-separated allowlist of auth emails to preserve untouched
-- (your real staging login accounts, e.g. the demo account). Everything else is mocked.

\set ON_ERROR_STOP on

begin;

-- ── Mock-identity helpers (session-local, auto-dropped) ──────────────────────
-- Two name pools (32 each → 1024 first/last combinations) drive every mock value.

create function pg_temp.mock_firsts() returns text[] language sql immutable as $$
  select array[
    'Avery','Blake','Cameron','Dakota','Emerson','Finley','Gray','Hayden',
    'Iris','Jordan','Kai','Logan','Morgan','Noel','Oakley','Parker',
    'Quinn','Riley','Sage','Tatum','Uri','Val','Wren','Xan',
    'Yael','Zion','Ari','Bryn','Cleo','Dane','Elliot','Frankie']::text[];
$$;

create function pg_temp.mock_lasts() returns text[] language sql immutable as $$
  select array[
    'Archer','Brooks','Carter','Dixon','Ellis','Fisher','Grant','Hale',
    'Irwin','Jensen','Knox','Lowe','Mercer','Nash','Owens','Pierce',
    'Quill','Reed','Sloan','Tate','Underwood','Vance','Walsh','Xiong',
    'York','Zimmer','Ash','Bowen','Cross','Doyle','Ember','Frost']::text[];
$$;

-- Non-negative index in [0, m) from a seed, without abs() (avoids INT_MIN overflow).
create function pg_temp.mock_idx(seed text, m int) returns int language sql immutable as $$
  select ((hashtext(seed) % m) + m) % m;
$$;

-- Bijective int → "First Last": every distinct n yields a distinct name. The first
-- 1024 values use the bare pools; beyond that a numeric suffix keeps it collision-free.
create function pg_temp.mock_name_at(n int) returns text language sql immutable as $$
  select (pg_temp.mock_firsts())[ (n / 32) % 32 + 1 ] || ' ' ||
         (pg_temp.mock_lasts())[ n % 32 + 1 ] ||
         case when n >= 1024 then ' ' || (n / 1024 + 1)::text else '' end;
$$;

-- Deterministic "First Last" from any seed (may collide across seeds; fine for emails
-- and metadata where the address itself carries a unique id suffix).
create function pg_temp.mock_name(seed text) returns text language sql immutable as $$
  select pg_temp.mock_name_at(pg_temp.mock_idx(seed, 1024));
$$;

create function pg_temp.mock_email(seed text) returns text language sql immutable as $$
  select lower(replace(pg_temp.mock_name(seed), ' ', '.') || '.' || substr(md5(seed), 1, 6))
         || '@staging.local';
$$;

-- 1. auth.users: replace real emails with deterministic mock addresses, and swap the
--    metadata name fields for a matching mock name instead of dropping them, so any
--    "logged-in user" name in the UI still renders. Skips the allowlist and anything
--    already mocked (@staging.local) so it stays idempotent.
update auth.users
set
  email = pg_temp.mock_email(id::text),
  phone = null,
  raw_user_meta_data = jsonb_set(
    jsonb_set(
      coalesce(raw_user_meta_data, '{}'::jsonb) - 'email' - 'avatar_url' - 'picture',
      '{full_name}', to_jsonb(pg_temp.mock_name(id::text)), true),
    '{name}', to_jsonb(pg_temp.mock_name(id::text)), true),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
where email is not null
  and email not like '%@staging.local'
  and (
    nullif(:'keep_emails', '') is null
    or lower(email) <> all (string_to_array(lower(:'keep_emails'), ','))
  );

-- 2. games.players[].displayName: replace each distinct real name with a stable mock
--    "First Last". Persisting the mapping (public.staging_name_map) means the SAME
--    person maps to the SAME mock across every game AND across re-syncs, which preserves
--    pod / commander ELO grouping (keyed on displayName), and distinct real names get
--    distinct mocks so groups never merge. Names already present as a mock are skipped,
--    keeping the step idempotent without relying on a recognizable name pattern.
create table if not exists public.staging_name_map (
  orig text primary key,
  fake text not null unique
);

with new_names as (
  select distinct e->>'displayName' as orig
  from public.games,
       jsonb_array_elements(players) as e
  where e ? 'displayName'
    and (e->>'displayName') is not null
    and (e->>'displayName') not in (select orig from public.staging_name_map)
    and (e->>'displayName') not in (select fake from public.staging_name_map)
),
ranked as (
  select orig,
    (dense_rank() over (order by md5(orig)) - 1
      + (select count(*) from public.staging_name_map))::int as n
  from new_names
)
insert into public.staging_name_map (orig, fake)
select orig, pg_temp.mock_name_at(n)
from ranked
on conflict (orig) do nothing;

update public.games g
set players = sub.p
from (
  select g2.id,
    jsonb_agg(
      case
        when e ? 'displayName' and m.fake is not null
        then jsonb_set(e, '{displayName}', to_jsonb(m.fake))
        else e
      end
      order by ord
    ) as p
  from public.games g2,
       jsonb_array_elements(g2.players) with ordinality as t(e, ord)
       left join public.staging_name_map m on m.orig = e->>'displayName'
  group by g2.id
) sub
where g.id = sub.id;

-- 3. games.notes: free-text may contain anything and can't be meaningfully mocked.
--    Redact while preserving the "has notes" signal so notes-rendering UI still shows.
update public.games
set notes = '[redacted for staging]'
where notes is not null
  and notes <> '[redacted for staging]';

-- 4. invite_codes are signup secrets. Staging is private, so they are copied as-is.
--    Uncomment to deactivate every copied code instead:
-- update public.invite_codes set active = false, remaining_uses = 0;

commit;

\echo 'Mock-PII anonymization complete.'
