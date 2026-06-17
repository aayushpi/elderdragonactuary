# Staging environment

A true staging environment: a **stable URL** backed by the `eda-staging` Supabase
project, holding an **anonymized copy of production data** so you can test against
realistic data without touching real users or prod.

| Layer | Production | Staging |
| --- | --- | --- |
| Supabase project | live prod project | `eda-staging` (`jqbwndjfqwbijmdjoljt`) |
| Vercel | Production deployment | stable staging alias (see below) |
| Data | real | anonymized copy of prod |

Local dev and Vercel Preview already point at `eda-staging` via `.env` /
`.env.example`, so this just makes that target stable and seeds it with real-shaped data.

## 1. Stable staging URL (Vercel — manual)

There is no custom root domain, so use a stable `*.vercel.app` alias instead of the
rotating per-commit preview hashes.

1. Create/choose a long-lived branch for staging (e.g. keep `feat/auth-staging`, or
   make a dedicated `staging` branch).
2. Vercel → Project **gocommando** → Settings → **Domains** → add an alias such as
   `gocommando-staging.vercel.app` and assign it to that branch.
   (CLI equivalent: `vercel alias set <latest-staging-deployment-url> gocommando-staging.vercel.app`.)
3. In Vercel → Settings → **Environment Variables**, ensure the **staging branch**
   resolves `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to the `eda-staging`
   project (Preview scope already does; confirm the alias inherits it).

## 2. Supabase redirect allowlist (dashboard — manual)

Password reset / magic links redirect to `${window.location.origin}/reset-password`
(`src/providers/AuthProvider.tsx`), so every host that serves the app must be allowlisted.

Supabase Dashboard → project **eda-staging** → Authentication → **URL Configuration**
→ *Redirect URLs*:

```
http://localhost:5173/**
https://gocommando-staging.vercel.app/**
https://*-<vercel-team-slug>.vercel.app/**
```

Line 2 is the exact stable staging alias. Line 3 is optional — it covers ephemeral PR
preview deploys, using Supabase's required wildcard form (`*` must lead the subdomain
label, with your Vercel team/account slug as the literal suffix; `gocommando-*` is
rejected by the validator). Skip line 3 if you only test on the stable staging URL.
(None of this can be set via the Supabase MCP — it only exposes DB/migration tools, not
auth config.)

## 3. Seed staging with an anonymized copy of prod

Run [`scripts/sync-staging-data.sh`](scripts/sync-staging-data.sh). It exports
`public.games` and `public.invite_codes` from prod, loads them into staging (public
tables fully replaced), then runs [`scripts/staging-anonymize.sql`](scripts/staging-anonymize.sql).

```bash
# Connection strings: Supabase Dashboard -> Settings -> Database -> Connection string (URI)
export PROD_DB_URL='postgresql://postgres:<pw>@db.<prod-ref>.supabase.co:5432/postgres'
export STAGING_DB_URL='postgresql://postgres:<pw>@db.jqbwndjfqwbijmdjoljt.supabase.co:5432/postgres'
export STAGING_OWNER_EMAIL='you@example.com'            # staging login that will own the games
export KEEP_EMAILS='you@example.com,demo@example.com'   # staging logins to keep usable
./scripts/sync-staging-data.sh
```

Requires `psql` (`brew install libpq`). The script refuses to run unless
`STAGING_DB_URL` points at `eda-staging` and `PROD_DB_URL` does not — it cannot write
to prod.

### Why games are reassigned to one owner

Production users are **not** imported. Every imported game is reassigned to
`STAGING_OWNER_EMAIL` because RLS only shows each user their own games and you can't log
in as anonymized prod users — so without this, the staging UI would look empty. Sign in
as that account to see the whole dataset. Bonus: real prod emails never enter staging.

### What gets anonymized

- `games.players[].displayName` → deterministic `Player <hash>` (same person → same
  fake everywhere, so pod / commander ELO grouping is preserved).
- `games.notes` → `[redacted for staging]`.
- `auth.users.email` → `user+<id>@staging.local` for any account not in `KEEP_EMAILS`
  (defensive; with the reassignment approach only your staging logins exist anyway).

IDs, dates, win/loss, commanders, seats, brackets, and per-game relationships are
preserved, so staging behaves like prod — just without real PII, and all under one
login. Re-run any time to refresh the snapshot; the anonymization is idempotent.

### Re-syncing (refreshing the snapshot)

The sync **does not run automatically** — no cron, CI, or scheduled job. Staging holds a
point-in-time snapshot from the last time the script was run, and that's fine: stale
data is perfectly usable for testing. Re-syncing is optional.

To refresh, just run the same command again with the same env vars:

```bash
export PROD_DB_URL='...' STAGING_DB_URL='...' STAGING_OWNER_EMAIL='...' KEEP_EMAILS='...'
./scripts/sync-staging-data.sh
```

What a re-sync does:

- **Fully replaces** `public.games` and `public.invite_codes` (they are `TRUNCATE`d and
  reloaded), so any games you logged or edited while testing on staging are wiped and
  replaced with a fresh anonymized copy of prod. Your staging **login accounts**
  (`KEEP_EMAILS`) are preserved.
- Re-runs the anonymizer; it is idempotent, so repeated runs are safe.

When you'd actually want to re-sync:

- Staging got cluttered with test data and you want a clean realistic baseline back.
- You need recent prod patterns (new commanders, larger game volume) for a test.
- You want fresh-ish data for a demo.

If you don't re-sync, nothing breaks — staging simply stays frozen at the last snapshot
plus whatever you changed while testing.
