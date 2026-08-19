/**
 * PostHog bootstrap.
 *
 * Follows the same contract as `lib/supabase.ts` and `lib/featurebase.ts`: when
 * `VITE_POSTHOG_API_KEY` is absent every export here is an inert no-op, so the
 * app runs identically with analytics switched off. Nothing in this file may
 * throw — a broken analytics provider must never break the app.
 *
 * `posthog-js` is ~85 kB gzipped, so it is imported dynamically rather than
 * bundled into the entry chunk: this app is opened on phones at a table, and
 * analytics must never sit on the critical path. Calls made before the SDK
 * finishes loading are queued in order and flushed on arrival, which matters
 * because `identify` has to land before the events it attributes.
 */

import type { PostHog } from 'posthog-js'

const apiKey = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined
const apiHost = (import.meta.env.VITE_POSTHOG_API_HOST as string | undefined) || 'https://us.i.posthog.com'

/** Bounded so a failed SDK load can't grow the queue without limit. */
const MAX_QUEUED = 50

type QueuedCall = (ph: PostHog) => void

let client: PostHog | null = null
let started = false
let queue: QueuedCall[] = []

export function isAnalyticsEnabled(): boolean {
  return Boolean(apiKey) && typeof window !== 'undefined'
}

export function initAnalytics(): void {
  if (started) return
  started = true
  if (!isAnalyticsEnabled()) return

  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(apiKey!, {
        api_host: apiHost,
        // Every event this app sends is declared in events.ts. Autocapture
        // would bury those under undeclared $autocapture events nothing queries.
        autocapture: false,
        // The router drives pageviews (see usePageviews) — PostHog's own
        // listener only fires on a full document load, which in a SPA means
        // once per session.
        capture_pageview: false,
        capture_pageleave: true,
        // Anonymous visitors stay eventful but personless; only signed-in
        // users become billable person profiles.
        person_profiles: 'identified_only',
        disable_session_recording: true,
        persistence: 'localStorage+cookie',
        on_xhr_error: () => {},
      })
      posthog.register({ app_env: import.meta.env.MODE })
      client = posthog

      const pending = queue
      queue = []
      for (const call of pending) {
        try {
          call(posthog)
        } catch {
          void 0
        }
      }
    })
    .catch(() => {
      queue = []
    })
}

/** Runs `fn` against the SDK now, or queues it until the SDK has loaded.
 *  Drops the call entirely when analytics is not configured. */
export function withClient(fn: QueuedCall): void {
  try {
    if (client) {
      fn(client)
      return
    }
    if (!isAnalyticsEnabled()) return
    if (queue.length >= MAX_QUEUED) return
    queue.push(fn)
  } catch {
    void 0
  }
}

/** Test seam: how many calls are waiting on the SDK to finish loading. */
export function getQueueLengthForTests(): number {
  return queue.length
}

/** Test seam: lets the suite assert the no-op contract from a clean slate. */
export function resetAnalyticsForTests(): void {
  client = null
  started = false
  queue = []
}
