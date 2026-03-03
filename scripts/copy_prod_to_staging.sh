#!/usr/bin/env bash
set -euo pipefail

# Copy Production Postgres (Supabase) to Staging using pg_dump + pg_restore
# Usage:
#   PROD_DB_URL="postgres://..." STAGING_DB_URL="postgres://..." ./scripts/copy_prod_to_staging.sh
# or
#   ./scripts/copy_prod_to_staging.sh "postgres://..." "postgres://..."
#
# Notes:
# - The Postgres URLs should include sslmode=require if needed by Supabase.
# - This will overwrite objects in the staging database. Use with caution.
# - Requires `pg_dump` and `pg_restore` (Postgres client tools). On macOS: `brew install libpq` and add to PATH.

PROG_NAME=$(basename "$0")
usage() {
  cat <<EOF
Usage: $PROG_NAME [PROD_DB_URL] [STAGING_DB_URL]

You can also provide the URLs via env vars: PROD_DB_URL and STAGING_DB_URL.

This script will dump the production DB to a temporary file and restore it into staging.
EOF
  exit 1
}

PROD_DB_URL=${1:-${PROD_DB_URL:-}}
STAGING_DB_URL=${2:-${STAGING_DB_URL:-}}

if [[ -z "$PROD_DB_URL" || -z "$STAGING_DB_URL" ]]; then
  echo "Error: PROD_DB_URL and STAGING_DB_URL are required."
  usage
fi

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump not found. Install Postgres client tools."; exit 2; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore not found. Install Postgres client tools."; exit 2; }

echo "WARNING: This will OVERWRITE objects in the staging database."
read -r -p "Type 'yes' to continue: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

TMP_DUMP=$(mktemp /tmp/prod_dump.XXXX.dump)
trap 'rm -f "$TMP_DUMP"' EXIT

echo "Dumping production database to $TMP_DUMP ..."
pg_dump --format=custom --no-owner --no-acl "$PROD_DB_URL" -f "$TMP_DUMP"

echo "Restoring dump into staging (this may take a while)..."
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$STAGING_DB_URL" "$TMP_DUMP"

echo "Restore complete. Temporary dump removed."

exit 0
