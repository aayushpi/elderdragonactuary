import type { Game, Player } from '@/types'

function getPosthog(): unknown | undefined {
  return (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).posthog) || undefined
}

export function track(event: string, props?: Record<string, unknown>): void {
  try {
    const ph = getPosthog() as { capture?: (event: string, props?: Record<string, unknown>) => void } | undefined
    if (!ph?.capture) return
    ph.capture(event, props ?? {})
  } catch {
    void 0
  }
}

export function identify(id: string): void {
  try {
    const ph = getPosthog() as { identify?: (id: string) => void } | undefined
    if (!ph?.identify) return
    ph.identify(id)
  } catch {
    void 0
  }
}

export function trackAppStarted(props?: Record<string, unknown>) {
  track('app_started', props)
}

export function trackUserSignedIn(props?: { user_id?: string; method?: string }) {
  if (props?.user_id) identify(props.user_id)
  track('user_signed_in', props)
}

export function trackUserSignedUp(props?: { user_id?: string; method?: string }) {
  if (props?.user_id) identify(props.user_id)
  track('user_signed_up', props)
}

export function trackGameLogged(game: Partial<Game>) {
  const safeProps: Record<string, unknown> = {
    players: game.players?.length ?? undefined,
    win_turn: game.winTurn ?? undefined,
    has_partners: Boolean(game.players?.some((p) => Boolean((p as Partial<Player>)?.partnerName))),
    fast_mana_used: Boolean(game.players?.some((p) => Boolean((p as Partial<Player>)?.fastMana?.hasFastMana))),
    source: typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  }
  track('game_logged', safeProps)
}

export function trackViewStats(props?: { stats_view?: string; games_played?: number }) {
  track('view_stats', props)
}
