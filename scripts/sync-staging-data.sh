#!/usr/bin/env bash
#
# sync-staging-data.sh — copy production data into the eda-staging project, anonymized.
#
# Pulls public.games and public.invite_codes from production, loads them into staging,
# then runs scripts/staging-anonymize.sql to replace PII with realistic mock PII.
# Public tables are fully replaced.
#
# Production users are NOT imported. Every imported game is reassigned to one staging
# login (STAGING_OWNER_EMAIL) so you can actually see the data in-app — RLS only shows
# each user their own games, and you can't log in as anonymized prod users. As a bonus,
# real prod emails never touch staging at all.
#
# Usage:
#   export PROD_DB_URL='postgresql://postgres:<pw>@db.<prod-ref>.supabase.co:5432/postgres'
#   export STAGING_DB_URL='postgresql://postgres:<pw>@db.jqbwndjfqwbijmdjoljt.supabase.co:5432/postgres'
#   export STAGING_OWNER_EMAIL='you@example.com'   # existing staging login that will own the games
#   export KEEP_EMAILS='you@example.com,demo@example.com'   # staging logins to preserve (optional)
#   ./scripts/sync-staging-data.sh
#
# Get each connection string from Supabase Dashboard -> Project -> Settings -> Database
# -> "Connection string" (URI). Requires psql in PATH (brew install libpq).

set -euo pipefail

readonly STAGING_REF="jqbwndjfqwbijmdjoljt"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ANON_SQL="${SCRIPT_DIR}/staging-anonymize.sql"
KEEP_EMAILS="${KEEP_EMAILS:-}"

die() { echo "error: $*" >&2; exit 1; }

# ── Preconditions ────────────────────────────────────────────────────────────
command -v psql >/dev/null 2>&1 || die "psql not found in PATH (brew install libpq)"
[[ -n "${PROD_DB_URL:-}" ]]        || die "PROD_DB_URL is not set"
[[ -n "${STAGING_DB_URL:-}" ]]     || die "STAGING_DB_URL is not set"
[[ -n "${STAGING_OWNER_EMAIL:-}" ]] || die "STAGING_OWNER_EMAIL is not set (the staging login that will own imported games)"
[[ -f "$ANON_SQL" ]]               || die "missing $ANON_SQL"

# ── Safety guards: never write to prod, never read staging as if it were prod ──
[[ "$STAGING_DB_URL" == *"$STAGING_REF"* ]] \
  || die "STAGING_DB_URL does not point at the eda-staging project ($STAGING_REF). Refusing to write."
[[ "$PROD_DB_URL" != *"$STAGING_REF"* ]] \
  || die "PROD_DB_URL points at the staging project. That is not production. Aborting."
[[ "$PROD_DB_URL" != "$STAGING_DB_URL" ]] \
  || die "PROD_DB_URL and STAGING_DB_URL are identical. Aborting."

echo "This will REPLACE public.games and public.invite_codes in staging ($STAGING_REF)"
echo "with anonymized production data. Existing staging login accounts are preserved."
read -r -p "Type 'sync' to proceed: " confirm
[[ "$confirm" == "sync" ]] || die "aborted"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Resolve the staging login that will own the imported games.
OWNER_ID="$(psql "$STAGING_DB_URL" -tAX -v ON_ERROR_STOP=1 \
  -c "select id from auth.users where email = '$STAGING_OWNER_EMAIL' limit 1")"
[[ -n "$OWNER_ID" ]] || die "no staging user found for STAGING_OWNER_EMAIL=$STAGING_OWNER_EMAIL"

# ── 1. Export from production ────────────────────────────────────────────────
echo "==> Exporting from production..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "\copy (select * from public.games)        to '$TMP_DIR/games.csv'        with (format csv, header true)"
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "\copy (select * from public.invite_codes) to '$TMP_DIR/invite_codes.csv' with (format csv, header true)"

# ── 2. Load into staging (single transaction) ────────────────────────────────
echo "==> Loading into staging (games owned by $STAGING_OWNER_EMAIL)..."
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
begin;

-- games: load into a staging temp table, reassign ownership to the chosen staging
-- login, then replace public.games. No prod users are imported (avoids the auth
-- signup trigger and keeps prod emails out of staging entirely).
create temp table _imp_games (like public.games including defaults) on commit drop;
\copy _imp_games from '$TMP_DIR/games.csv' with (format csv, header true)
update _imp_games set user_id = '$OWNER_ID';

truncate public.games;
insert into public.games select * from _imp_games;

-- invite_codes have no FK to auth.users: replace directly.
truncate public.invite_codes;
\copy public.invite_codes from '$TMP_DIR/invite_codes.csv' with (format csv, header true)

commit;
SQL

# ── 3. Anonymize PII ─────────────────────────────────────────────────────────
echo "==> Anonymizing PII..."
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -q \
  -v keep_emails="$KEEP_EMAILS" -f "$ANON_SQL"

echo "==> Done. Staging now holds an anonymized copy of production."
