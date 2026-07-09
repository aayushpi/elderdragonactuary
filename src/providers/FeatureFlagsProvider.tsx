import { useEffect, useMemo, useState, type ReactNode } from "react"
import { FeatureFlagsContext } from "@/hooks/useFeatureFlags"
import {
  FEATURE_FLAG_KEYS,
  liveGameForce,
  resolveLiveGameEnabled,
  type FeatureFlagKey,
} from "@/lib/featureFlags"

interface PostHogFlags {
  isFeatureEnabled?: (key: string) => boolean | undefined
  onFeatureFlags?: (cb: () => void) => void
}

function getPosthog(): PostHogFlags | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { posthog?: PostHogFlags }).posthog
}

function readFlags(ph: PostHogFlags | undefined): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const key of FEATURE_FLAG_KEYS) next[key] = ph?.isFeatureEnabled?.(key) === true
  return next
}

/* PostHog is loaded asynchronously (see lib/posthog.ts), so the global may not
 * exist yet at mount. Subscribe to onFeatureFlags when available, poll briefly
 * for the global to appear, and settle to "all off" if it never does — the env
 * force in resolve* still applies, so local/Preview overrides work regardless. */
export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let settled = false

    const settle = (next: Record<string, boolean>) => {
      if (cancelled) return
      settled = true
      setFlags(next)
      setReady(true)
    }

    const attach = (): boolean => {
      const ph = getPosthog()
      if (!ph?.onFeatureFlags) return false
      ph.onFeatureFlags(() => settle(readFlags(getPosthog())))
      return true
    }

    if (attach()) {
      const t = window.setTimeout(() => { if (!settled) settle(readFlags(getPosthog())) }, 3000)
      return () => { cancelled = true; window.clearTimeout(t) }
    }

    const start = Date.now()
    const id = window.setInterval(() => {
      if (attach() || Date.now() - start > 3000) {
        window.clearInterval(id)
        if (!settled) settle(readFlags(getPosthog()))
      }
    }, 200)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  const value = useMemo(
    () => ({
      flags,
      ready,
      isEnabled: (key: FeatureFlagKey): boolean => {
        if (key === "live-game") return resolveLiveGameEnabled(flags["live-game"] ?? false, liveGameForce())
        return flags[key] ?? false
      },
    }),
    [flags, ready]
  )

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}
