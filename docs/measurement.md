# Measurement strategy

How we know whether Elder Dragon Actuary is working. Two systems, deliberately
split:

| Question | System | Why |
| --- | --- | --- |
| *Is the product working?* Funnels, retention, which surfaces drive logging | **PostHog** | Behavioural, needs sequencing and cohorts |
| *Who is using it?* Per-account roster, games logged, last logged | **Supabase** (`/admin`) | Ground truth in the `games` table, not sampled events |

They are not redundant. PostHog can tell you that activation dropped last week;
`/admin` tells you which four accounts it was. PostHog's query API also needs a
personal API key, which cannot ship in a client bundle — so the roster could not
be built on it even if we wanted to.

---

## 1. North star

**Games logged per active user per week.**

The app has exactly one job: make logging a Commander game fast enough that
people actually do it, at the table, on a phone, mid-game. Every other metric
here is either an input to that number or an early warning that it is about to
move.

Deliberately *not* the north star:

- **Total games logged** — grows even while every individual user is churning.
- **DAU/MAU** — someone opening the app to browse their stats is nice, but it
  isn't the job. Stats viewing is a *retention* signal, not the value itself.
- **Sign-ups** — the app is invite-gated; sign-up volume measures how many codes
  we handed out, nothing more.

## 2. The funnel

```
                                              measured by
  Lands on the logged-out page          →     $pageview (anonymous)
  Enters an invite code                 →     signup_started
  Account created                       →     user_signed_up
  ── ACTIVATION ──────────────────────────────────────────────
  Logs their first game                 →     game_logged (person's 1st)
  ── HABIT ───────────────────────────────────────────────────
  Logs a 3rd game                       →     game_logged (person's 3rd)
  Returns in week 2                     →     game_logged, 7–14d after signup
```

**Activation is the first logged game**, not the sign-up. An account with an
invite code and zero games is a failure that looks like a success in a sign-up
count — which is why `/admin` puts "Activated" next to "Accounts" and why the
per-account table sorts an all-zero row to the bottom rather than hiding it.

The two questions worth answering first:

1. **Where does the first game die?** If `signup_started → user_signed_up` is
   healthy but `user_signed_up → game_logged` is not, the invite flow is fine
   and the logging flow is too slow. `game_log_started` minus `game_logged`
   isolates that: people who opened the flow and bailed.
2. **Does logging survive the first session?** `game_log_abandoned` with
   `had_unsaved_changes: true` is the specific, fixable failure — someone typed
   real data and lost it.

## 3. Event taxonomy

All events are declared in `src/lib/analytics/events.ts`. That file is the
source of truth; `capture()` will not compile for an event or property that
isn't in it. Add events there first, then document them here.

### Lifecycle

| Event | Fires when | Key properties |
| --- | --- | --- |
| `app_opened` | Session restored on load | `is_authenticated`, `is_standalone` |

`is_standalone` tells us who installed it to the home screen — the strongest
available proxy for "uses this at the table" versus "looked at it once on a
laptop".

### Auth

| Event | Fires when | Key properties |
| --- | --- | --- |
| `signup_started` | Sign-up submitted | — |
| `user_signed_up` | Sign-up succeeded | `method` |
| `user_signed_in` | Returning sign-in | `method` |
| `user_signed_out` | Sign-out | — |
| `signup_failed` | Sign-up rejected | `reason` |

`signup_failed` with `reason: invalid_invite_code` is the one to watch: a spike
means codes are circulating publicly or someone is guessing.

### Core loop

| Event | Fires when | Key properties |
| --- | --- | --- |
| `game_log_started` | Log flow opened (button *or* the `n` shortcut) | `entry_point`, `prefilled` |
| `game_logged` | Game saved | pod size, win turn, is_win, partners, fast mana, bracket |
| `game_log_abandoned` | Log flow closed unsaved | `had_unsaved_changes` |
| `game_updated` | Existing game edited | `pod_size` |
| `game_deleted` | Game deleted | `surface` |

`entry_point` is the one that pays for itself. It distinguishes the nav button
from the dashboard's empty state from a commander card, so we can tell which
surface actually drives logging and stop guessing which entry points to keep.

### Live game

| Event | Fires when |
| --- | --- |
| `live_game_started` | Live board opened |
| `live_game_completed` | Live game saved |
| `live_game_abandoned` | Live board exited without saving |

Started-minus-completed is the honest measure of whether live tracking survives
contact with an actual game. This is the feature most likely to look popular in
a click count and fail in practice.

### Onboarding

| Event | Fires when | Key properties |
| --- | --- | --- |
| `onboarding_started` | Walkthrough opens | `source` (`auto` on first run, `settings` on replay) |
| `onboarding_step_viewed` | Each step is shown | `step_id`, `step_index` |
| `onboarding_completed` | Finished on the last step | `steps` |
| `onboarding_skipped` | Skipped or dismissed | `step_id`, `step_index` |

`step_viewed` is a drop-off curve: the step where people quit is the step whose
copy or surface is not earning its place. Completed-over-started says whether
the tour is worth its interruption at all.

### Engagement and data

| Event | Fires when | Key properties |
| --- | --- | --- |
| `stats_viewed` | Stats page rendered | `range`, `games_played` |
| `history_viewed` | History opened | `games_count` |
| `game_detail_opened` | A history row expanded | — |
| `games_imported` / `games_exported` / `games_cleared` | Settings data actions | `games_count` |
| `theme_changed` / `accent_changed` | Personalisation | `mode` / `accent` |
| `feedback_opened` | A Featurebase entry point clicked | `surface`, `widget` |

`games_cleared` deserves an alert. Someone wiping their data is the loudest
churn signal the app can emit, and it happens *before* they stop showing up.

The "load test JSON" button in Settings deliberately does **not** emit
`games_imported`. It is a developer affordance, and counting it would inflate
the only metric that tells us real backups are being restored.

### Person properties

Set on the PostHog person rather than events, so cohorts are a property filter
instead of an event roll-up:

- `email` — for support lookups and targeting
- `signup_date` (`$set_once`) — acquisition cohort, never overwritten
- `games_logged`, `last_game_at` — mirrored from the account's games

This is what makes "everyone with 10+ games" or "signed up 30+ days ago and
still logging" a two-click cohort.

## 4. Dashboards to build in PostHog

Six insights, each tied to a decision:

1. **Activation funnel** — `user_signed_up → game_logged`, 7-day window.
   *Decision: is onboarding or the log flow the bottleneck?*
2. **Weekly logging rate** — `game_logged` per active person, weekly.
   *The north star. Everything else explains this line.*
3. **Retention** — `game_logged` retention by signup cohort, weekly.
   *Decision: are we keeping people, or refilling a leaky bucket?*
4. **Entry-point breakdown** — `game_log_started` by `entry_point`.
   *Decision: which surfaces earn their place?*
5. **Abandonment** — `game_log_started` minus `game_logged`, split by
   `had_unsaved_changes`. *Decision: where is the flow losing real data?*
6. **Live-game completion** — `live_game_completed` / `live_game_started`.
   *Decision: does live tracking survive a real game?*

Two alerts worth setting: any `games_cleared`, and a `signup_failed`
(`invalid_invite_code`) spike.

## 5. Privacy guardrails

What we deliberately never send:

- **No free text.** No notes, no deck names, no player display names. Pod
  composition is real people who did not sign up for this.
- **No commander names on events.** They are in the user's own data, and the
  aggregate questions here are about pod *shape*, not decklists.
- **No session recording.** Disabled in code, not just in project settings.
- **No autocapture.** Every event is declared; nothing is collected by accident.
- **`person_profiles: 'identified_only'`** — anonymous visitors stay eventful
  but personless.

Email is the one identifier sent, deliberately, so support requests and the
admin roster line up.

Analytics is entirely optional: with `VITE_POSTHOG_API_KEY` unset, every entry
point in `src/lib/analytics/` is an inert no-op and the SDK is never even
fetched. This is a tested contract, not an intention — see
`src/lib/__tests__/analytics.test.ts`.

## 6. The admin dashboard

`/admin`, visible only to accounts in `public.admins`.

**Headline tiles:** accounts, activated (and the activation rate), 7d/30d
active, total games with a **median** per account. Median rather than mean — one
power user with hundreds of games makes a mostly-idle roster look healthy.

**Per-account table:** games logged, last game, 7d and 30d volume, distinct
active days, win rate, signup date, last sign-in. Sortable and filterable, with
lapsed accounts (30+ days idle) in amber and zero-game accounts muted.

Two distinctions the page is careful about:

- **`last_game_at` vs `last_logged_at`** — when the game was *played* versus
  when the row was *written*. Someone backfilling a season of games is not the
  same as someone playing weekly, and only the second one is retention.
- **Null vs zero** — an account with no games shows `—` for win rate, not `0%`.
  "Never logged a game" and "never won" are different states.

### Granting admin access

Membership is seeded from `public.admin_bootstrap_emails` two ways: a backfill
for accounts that already exist, and an `auth.users` trigger for ones created
later. Both are needed — with only the backfill, a bootstrap email that signs up
*after* the migration runs would never gain access, and the failure would be
silent.

To grant admin to someone else, from the Supabase SQL editor:

```sql
insert into public.admins (user_id, note)
select id, 'why they need it' from auth.users where email = 'them@example.com';
```

Both roster tables have RLS on with no policies, so admin can never be granted
from the client — only from the SQL editor.
