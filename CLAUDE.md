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

Optional analytics (PostHog):
```
VITE_POSTHOG_API_KEY=
VITE_POSTHOG_API_HOST=     # defaults to https://us.i.posthog.com
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

## Analytics

`src/lib/analytics/` is the only place `posthog-js` is imported. Components call
`capture()` from `@/lib/analytics`; they never touch the SDK directly.

- **Declare events first.** `events.ts` maps every event name to its property
  shape. `capture()` will not compile for an undeclared event or a wrong
  property, which is the point — no event reaches PostHog without being written
  down. Document new ones in `docs/measurement.md`.
- **Same no-op contract as Supabase and Featurebase.** With no
  `VITE_POSTHOG_API_KEY`, nothing initialises, the SDK is never fetched, and
  every call is inert. Nothing in `client.ts` may throw.
- **The SDK is dynamically imported** and must stay that way — it is ~85 kB
  gzipped and this app is opened on phones. Calls made before it loads are
  queued in order and flushed on arrival.
- **Never capture free text** — no notes, deck names, or player display names.
  Pod composition is real people who did not sign up for this.
- **Don't call `capture()` inside a `setState` updater**; React may run an
  updater twice and double-count the event.

## Onboarding walkthrough

`src/components/onboarding/` holds the guided tour: `steps.ts` is the ordered
script, `OnboardingTour.tsx` the overlay. A step can move the app to the surface
it describes (`route`, `drawer`) and spotlight a real element by `data-tour`
attribute; a step whose target is absent falls back to a centred card, so an
account with no games still gets the whole tour.

A brand-new account has nothing to look at, so while the tour runs on an empty
account the app renders the same sample pod the marketing page uses
(`buildDemoGames` in `src/components/home/demoData.ts`), the log form is
pre-filled from it, and both the tour card and the stats page carry a "Sample
data" badge. Nothing is written anywhere — it reverts when the tour ends.

State lives in `src/lib/onboarding.ts` (`commando_onboarding` in localStorage).
It runs once for every player — new and existing — and can be replayed from
Settings → Getting started. Bump `ONBOARDING_VERSION` to re-run a materially
changed tour for everyone.

When adding a spotlight, put `data-tour` on an element that is always mounted on
that surface; the tour drives the drawer itself and must never leave a user's
in-progress log flow behind.

## Admin dashboard

`/admin` shows usage by account, gated on the `is_admin()` RPC. It reads
Supabase, not PostHog: PostHog's query API needs a personal key that can't ship
in a client bundle, and "games logged" is the `games` table itself.

RLS limits every account to its own games, so the reporting functions in
`supabase/migrations/007_admin_usage.sql` are `security definer` and check
`public.admins` themselves. New admin queries belong there — never widen the
RLS policies on `games` to make an admin view easier.

## Testing

- Use `@testing-library/react` and `vitest`. Mocks for `localStorage` and `supabase` live in `src/setupTests.ts`.
- Don't mock the Supabase client in new tests — use the built-in no-op stub by omitting env vars.
- Place component tests in `src/components/__tests__/`, hook/lib tests in `src/lib/__tests__/` or `src/hooks/__tests__/`.
