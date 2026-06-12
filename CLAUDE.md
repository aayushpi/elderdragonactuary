# Elder Dragon Actuary (Commando) — Claude Guide

## Project overview

MTG Commander (EDH) game tracker. Users log 2–6 player games and track win rates and ELO ratings. Internal package name is `commando`.

## Commands

```bash
npm run dev          # start dev server at http://localhost:5173
npm run build        # tsc -b && vite build
npm run test         # vitest (watch mode)
npm run test:ci      # vitest run (single pass, for CI)
npm run lint         # eslint
npm run preview      # preview production build
```

Always run `npm run build` and `npm run lint` before reporting a task complete. Fix all TypeScript and ESLint errors — CI will catch them.

## Tech stack

- **React 19 + TypeScript** — strict mode, path alias `@/` → `src/`
- **Vite 6** — dev server and bundler
- **Tailwind CSS 3 + Shadcn/ui** — Radix primitives wrapped in `src/components/ui/`
- **Vitest + Testing Library** — unit and component tests in `src/__tests__/` and `src/components/__tests__/`
- **Supabase** — auth and cloud game storage; configured via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- **Vercel** — production deployment

## Project structure

```
src/
  pages/          page-level components (one per route)
  components/     shared UI components
  components/ui/  Shadcn/Radix primitives (don't edit these directly)
  hooks/          custom React hooks (useGames, useStats, useScryfall…)
  lib/            data layer (storage, stats, scryfall API, supabase, featurebase, validation)
  types/          TypeScript types (index.ts, database.ts)
  providers/      AuthProvider wrapping Supabase session
supabase/migrations/  SQL migrations (run against Supabase project)
scripts/          one-off utility scripts
public/           static assets (logo/ icon kit, manifest, favicon)
```

## Data storage

Two parallel storage backends coexist:

- **localStorage** (`src/lib/storage.ts`) — primary local storage; keys `commando_games`, `commando_pods`, `commando_profile`
- **Supabase** (`src/lib/supabaseStorage.ts`) — cloud backup when user is signed in

`src/lib/supabase.ts` returns a no-op stub when env vars are missing, so the app works without a Supabase project. Never throw or crash if Supabase is unconfigured.

## Key types (`src/types/`)

- `Game` / `Player` — core domain types; `Player.isMe` marks the logged-in user's player
- `SeatPosition` — `1 | 2 | 3 | 4 | 5 | 6`
- `ComputedStats` — output of the stats engine in `lib/stats.ts`
- `PodEloGroup` / `CommanderEloEntry` — ELO rating structures

## Supabase env vars

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional analytics:
```
VITE_POSTHOG_API_KEY=
VITE_POSTHOG_API_HOST=
```

Optional Featurebase (feedback, changelog, roadmap, help widgets):
```
VITE_FEATUREBASE_ORG=     # the "<org>" in <org>.featurebase.app
```

Copy `.env.example` to `.env` and fill in values for local development. Never commit `.env`.

## Coding conventions

- **No comments** unless the WHY is non-obvious. Well-named identifiers are enough.
- **No new Shadcn components** without checking `src/components/ui/` first.
- **Tailwind only** — no inline styles, no CSS modules (except `App.css` / `index.css`).
- **All new UI** must be mobile-first and tested at narrow viewport widths (this app is used at the table on phones).
- IDs are generated with `Math.random().toString(36) + Date.now().toString(36)` — keep this pattern consistent.
- Scryfall API calls go through `src/lib/scryfall.ts` and `src/hooks/useScryfall.ts`; never call Scryfall directly from components.

## Featurebase

`src/lib/featurebase.ts` lazy-loads the Featurebase SDK and exposes the
feedback/changelog/roadmap/help open helpers. It's a no-op unless
`VITE_FEATUREBASE_ORG` is set, and never throws when unconfigured (same contract
as Supabase). Entry points live in `Footer` and the Settings "Feedback & support"
card, both gated on `isFeaturebaseEnabled()`.

## Testing

- Use `@testing-library/react` and `vitest`. Mocks for `localStorage` and `supabase` live in `src/setupTests.ts`.
- Don't mock the Supabase client in new tests — use the built-in no-op stub by omitting env vars.
- Place component tests in `src/components/__tests__/`, hook/lib tests in `src/lib/__tests__/` or `src/hooks/__tests__/`.
