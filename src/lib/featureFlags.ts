/* Feature flags. PostHog is the control plane; a build-time env var can force a
 * flag on/off (used for local dev, Preview/staging, or an emergency override in
 * Production). Same no-op contract as the other optional integrations: when
 * PostHog is unconfigured, flags default off and the env force still applies. */

export type FeatureFlagKey = "live-game"

export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = ["live-game"]

export type FlagForce = "on" | "off" | undefined

function parseForce(raw: string | undefined): FlagForce {
  const v = raw?.trim().toLowerCase()
  return v === "on" ? "on" : v === "off" ? "off" : undefined
}

/** Build-time override for the live-game flag (VITE_LIVE_GAME_FORCE=on|off). */
export function liveGameForce(): FlagForce {
  return parseForce(import.meta.env.VITE_LIVE_GAME_FORCE as string | undefined)
}

/** Resolve the live-game flag: an explicit env force wins, else PostHog decides.
 *  Pure — the caller reads the env force (via liveGameForce) and passes it in. */
export function resolveLiveGameEnabled(posthogValue: boolean, force: FlagForce): boolean {
  if (force === "on") return true
  if (force === "off") return false
  return posthogValue
}
