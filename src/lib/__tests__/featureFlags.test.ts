import { describe, it, expect } from "vitest"
import { resolveLiveGameEnabled } from "@/lib/featureFlags"

describe("resolveLiveGameEnabled", () => {
  it("env force 'on' wins over PostHog", () => {
    expect(resolveLiveGameEnabled(false, "on")).toBe(true)
    expect(resolveLiveGameEnabled(true, "on")).toBe(true)
  })

  it("env force 'off' wins over PostHog", () => {
    expect(resolveLiveGameEnabled(true, "off")).toBe(false)
    expect(resolveLiveGameEnabled(false, "off")).toBe(false)
  })

  it("falls back to the PostHog value when force is unset", () => {
    expect(resolveLiveGameEnabled(true, undefined)).toBe(true)
    expect(resolveLiveGameEnabled(false, undefined)).toBe(false)
  })
})
