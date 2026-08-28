/**
 * Onboarding walkthrough state.
 *
 * The tour is shown once per device to *every* player — new signups and
 * existing accounts alike — until they finish or skip it. Bumping
 * ONBOARDING_VERSION re-runs it for everyone, which is how a materially
 * changed tour reaches people who already saw the old one.
 */

const ONBOARDING_KEY = "commando_onboarding"

export const ONBOARDING_VERSION = 1

export type OnboardingStatus = "completed" | "skipped"

export interface OnboardingState {
  version: number
  status: OnboardingStatus
  at: string
}

export function loadOnboarding(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    if (typeof parsed?.version !== "number") return null
    if (parsed.status !== "completed" && parsed.status !== "skipped") return null
    return { version: parsed.version, status: parsed.status, at: parsed.at ?? "" }
  } catch {
    return null
  }
}

export function saveOnboarding(status: OnboardingStatus): void {
  try {
    const state: OnboardingState = {
      version: ONBOARDING_VERSION,
      status,
      at: new Date().toISOString(),
    }
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private mode); the tour simply runs again.
  }
}

export function clearOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY)
  } catch {
    // ignore
  }
}

export function shouldShowOnboarding(): boolean {
  const state = loadOnboarding()
  return !state || state.version < ONBOARDING_VERSION
}
