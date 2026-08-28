/**
 * The complete event taxonomy. Every event the app can send is declared here,
 * with the exact shape of its properties, so `capture()` is checked at compile
 * time and a typo can never silently create a new event in PostHog.
 *
 * Adding an event? Add it here first, then document it in docs/measurement.md.
 * Events are `snake_case` nouns in the past tense; properties are `snake_case`
 * and never contain free text a user typed.
 */

export type AuthMethod = 'password'

/** Where the user was standing when they opened the log-game flow. Used to
 *  work out which surface actually drives logging. */
export type LogEntryPoint =
  | 'dashboard'
  | 'dashboard_empty_state'
  | 'stats'
  | 'history'
  | 'bottom_tabs'
  | 'nav'
  | 'commander_card'
  | 'keyboard_shortcut'
  | 'live_game'

export type DeviceKind = 'mobile' | 'desktop'

/** How the guided walkthrough was launched. */
export type OnboardingSource = 'auto' | 'settings'

export type StatsRange = 'Last 30 days' | 'Last 90 days' | 'This year' | 'All time'

export interface GameShapeProps {
  pod_size: number
  win_turn: number
  /** Did the logging user win this one? Drives the win-rate cohort splits. */
  is_win: boolean
  has_partners: boolean
  fast_mana_used: boolean
  bracket: number | null
  win_conditions_count: number
  device: DeviceKind
}

export interface AnalyticsEventMap {
  // ── Lifecycle ──────────────────────────────────────────────────────────
  app_opened: { app_env: string; is_authenticated: boolean; is_standalone: boolean }

  // ── Auth ───────────────────────────────────────────────────────────────
  signup_started: undefined
  user_signed_up: { method: AuthMethod }
  user_signed_in: { method: AuthMethod }
  user_signed_out: undefined
  signup_failed: { reason: 'invalid_invite_code' | 'other' }

  // ── Core loop: logging a game ──────────────────────────────────────────
  game_log_started: { entry_point: LogEntryPoint; prefilled: boolean }
  game_logged: GameShapeProps
  game_log_abandoned: { had_unsaved_changes: boolean }
  game_updated: { pod_size: number }
  game_deleted: { surface: 'history' | 'edit_drawer' }

  // ── Live game ──────────────────────────────────────────────────────────
  live_game_started: undefined
  live_game_completed: { pod_size: number; win_turn: number }
  live_game_abandoned: undefined

  // ── Onboarding ─────────────────────────────────────────────────────────
  onboarding_started: { source: OnboardingSource }
  onboarding_step_viewed: { step_id: string; step_index: number }
  onboarding_completed: { steps: number }
  onboarding_skipped: { step_id: string; step_index: number }

  // ── Engagement ─────────────────────────────────────────────────────────
  stats_viewed: { range: StatsRange; games_played: number }
  history_viewed: { games_count: number }
  game_detail_opened: undefined

  // ── Data management ────────────────────────────────────────────────────
  games_imported: { games_count: number }
  games_exported: { games_count: number }
  games_cleared: { games_count: number }

  // ── Personalisation ────────────────────────────────────────────────────
  theme_changed: { mode: 'light' | 'dark' | 'system' }
  accent_changed: { accent: string }

  // ── Feedback (Featurebase) ─────────────────────────────────────────────
  feedback_opened: { surface: 'footer' | 'settings'; widget: 'feedback' | 'changelog' | 'roadmap' | 'help' }

  // ── Admin ──────────────────────────────────────────────────────────────
  admin_dashboard_viewed: { accounts: number }
}

export type AnalyticsEventName = keyof AnalyticsEventMap

/** Events declared with `undefined` properties take no second argument at all,
 *  so `capture('user_signed_out')` type-checks and `capture('game_logged')`
 *  does not. */
export type AnalyticsEventArgs<E extends AnalyticsEventName> =
  AnalyticsEventMap[E] extends undefined ? [] : [props: AnalyticsEventMap[E]]
