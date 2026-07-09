import { createContext, useContext } from "react"
import type { FeatureFlagKey } from "@/lib/featureFlags"

export interface FeatureFlagsContextValue {
  /** raw PostHog flag values, keyed by flag key (false until loaded) */
  flags: Record<string, boolean>
  /** true once flag values have resolved (or PostHog is confirmed absent) */
  ready: boolean
  /** resolved enabled state, applying any build-time env force */
  isEnabled: (key: FeatureFlagKey) => boolean
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined)

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider")
  return ctx
}
