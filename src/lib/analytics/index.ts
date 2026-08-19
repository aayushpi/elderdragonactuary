/**
 * The only analytics surface the app imports. Components never touch
 * `posthog-js` directly — that keeps the taxonomy enforceable and the
 * unconfigured no-op guaranteed in one place.
 */

import { initAnalytics, isAnalyticsEnabled, withClient } from './client'
import type { AnalyticsEventArgs, AnalyticsEventName } from './events'

export { initAnalytics, isAnalyticsEnabled }
export type { AnalyticsEventName } from './events'

export function capture<E extends AnalyticsEventName>(
  event: E,
  ...args: AnalyticsEventArgs<E>
): void {
  const props = args[0] as Record<string, unknown> | undefined
  withClient((ph) => ph.capture(event, props))
}

export function capturePageview(path: string): void {
  withClient((ph) => ph.capture('$pageview', { $current_url: window.location.href, route: path }))
}

export interface IdentifyProps {
  userId: string
  email?: string
  signedUpAt?: string
}

/**
 * Bind the anonymous distinct id to the signed-in account. Idempotent, so it is
 * safe on every session restore. The signup date goes through `$set_once` so a
 * later profile update can't rewrite the acquisition cohort.
 */
export function identifyUser({ userId, email, signedUpAt }: IdentifyProps): void {
  withClient((ph) =>
    ph.identify(
      userId,
      email ? { email } : undefined,
      signedUpAt ? { signup_date: signedUpAt } : undefined,
    ),
  )
}

/** Person properties that describe the account's state rather than an action,
 *  so cohorts like "logged 10+ games" don't need event math to build. */
export function setPersonProperties(props: Record<string, unknown>): void {
  withClient((ph) => ph.setPersonProperties(props))
}

/** Must run on sign-out: without it the next account on a shared device
 *  inherits the previous person's distinct id. */
export function resetIdentity(): void {
  withClient((ph) => ph.reset())
}
