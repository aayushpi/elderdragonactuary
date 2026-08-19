/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * The no-op contract is the important one: with no VITE_POSTHOG_API_KEY the app
 * must behave identically to one with analytics wired up, and nothing here may
 * throw. Same guarantee lib/supabase.ts and lib/featurebase.ts give.
 */
describe("analytics — unconfigured", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it("reports itself disabled when no API key is set", async () => {
    const { isAnalyticsEnabled } = await import("@/lib/analytics")
    expect(isAnalyticsEnabled()).toBe(false)
  })

  it("never throws from any entry point", async () => {
    const analytics = await import("@/lib/analytics")

    expect(() => analytics.initAnalytics()).not.toThrow()
    expect(() => analytics.capture("user_signed_out")).not.toThrow()
    expect(() => analytics.capture("game_updated", { pod_size: 4 })).not.toThrow()
    expect(() => analytics.capturePageview("/stats")).not.toThrow()
    expect(() => analytics.identifyUser({ userId: "u1", email: "a@b.com" })).not.toThrow()
    expect(() => analytics.setPersonProperties({ games_logged: 3 })).not.toThrow()
    expect(() => analytics.resetIdentity()).not.toThrow()
  })

  it("does not load the PostHog SDK at all", async () => {
    const { initAnalytics } = await import("@/lib/analytics")
    const { getQueueLengthForTests } = await import("@/lib/analytics/client")

    initAnalytics()
    // Nothing queued means nothing is waiting on an SDK that will never arrive.
    expect(getQueueLengthForTests()).toBe(0)
  })
})

describe("analytics — configured", () => {
  const captures: Array<[string, unknown]> = []
  const identifies: string[] = []
  const order: string[] = []

  beforeEach(() => {
    vi.resetModules()
    captures.length = 0
    identifies.length = 0
    order.length = 0
    vi.stubEnv("VITE_POSTHOG_API_KEY", "phc_test_key")

    vi.doMock("posthog-js", () => ({
      default: {
        init: vi.fn(),
        register: vi.fn(),
        capture: (event: string, props?: unknown) => {
          captures.push([event, props])
          order.push(`capture:${event}`)
        },
        identify: (id: string) => {
          identifies.push(id)
          order.push(`identify:${id}`)
        },
        setPersonProperties: vi.fn(),
        reset: vi.fn(),
      },
    }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock("posthog-js")
  })

  it("flushes calls made before the SDK loaded, preserving order", async () => {
    const analytics = await import("@/lib/analytics")

    analytics.initAnalytics()
    // These all happen while the dynamic import is still in flight.
    analytics.identifyUser({ userId: "user-1", email: "a@b.com" })
    analytics.capture("game_logged", {
      pod_size: 4,
      win_turn: 8,
      is_win: true,
      has_partners: false,
      fast_mana_used: false,
      bracket: 3,
      win_conditions_count: 1,
      device: "mobile",
    })

    // Let the dynamic import resolve.
    await vi.waitFor(() => expect(captures.length).toBeGreaterThan(0))

    expect(identifies).toEqual(["user-1"])
    expect(captures.map(([event]) => event)).toEqual(["game_logged"])
    // identify must land first, or the event is attributed to the anonymous id.
    expect(order).toEqual(["identify:user-1", "capture:game_logged"])
  })

  it("caps the pre-load queue so a failed SDK load cannot grow it unbounded", async () => {
    const analytics = await import("@/lib/analytics")
    const { getQueueLengthForTests } = await import("@/lib/analytics/client")

    // Deliberately not calling initAnalytics, so nothing ever drains the queue.
    for (let i = 0; i < 200; i++) analytics.capture("game_detail_opened")

    expect(getQueueLengthForTests()).toBeLessThanOrEqual(50)
  })
})
