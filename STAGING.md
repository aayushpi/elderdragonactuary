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
`public.games`, `public.invite_codes`, and the referenced `auth.users` from prod,
loads them into staging (public tables fully replaced; `auth.users` upserted so your
staging logins survive), then runs [`scripts/staging-anonymize.sql`](scripts/staging-anonymize.sql).

```bash
# Connection strings: Supabase Dashboard -> Settings -> Database -> Connection string (URI)
export PROD_DB_URL='postgresql://postgres:<pw>@db.<prod-ref>.supabase.co:5432/postgres'
export STAGING_DB_URL='postgresql://postgres:<pw>@db.jqbwndjfqwbijmdjoljt.supabase.co:5432/postgres'
export KEEP_EMAILS='you@example.com,demo@example.com'   # staging logins to keep usable
./scripts/sync-staging-data.sh
```

Requires `psql` (`brew install libpq`). The script refuses to run unless
`STAGING_DB_URL` points at `eda-staging` and `PROD_DB_URL` does not — it cannot write
to prod.

### What gets anonymized

- `auth.users.email` → `user+<id>@staging.local`; phone and name metadata stripped.
  Accounts in `KEEP_EMAILS` are left untouched so you can still log in.
- `games.players[].displayName` → deterministic `Player <hash>` (same person → same
  fake everywhere, so pod / commander ELO grouping is preserved).
- `games.notes` → `[redacted for staging]`.

IDs, dates, win/loss, commanders, seats, brackets, and all relationships are preserved,
so staging behaves identically to prod — just without real PII. Re-run any time to
refresh the snapshot; the anonymization is idempotent.
