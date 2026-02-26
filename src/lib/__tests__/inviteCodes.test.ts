import { describe, it, expect, vi, afterEach } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("validateInviteCode", () => {
  it("accepts built-in Magic meme invite codes", async () => {
    const { validateInviteCode } = await import("@/lib/inviteCodes")
    expect(validateInviteCode("BOLT THE BIRD")).toBe(true)
    expect(validateInviteCode("dies to doom blade")).toBe(true)
    expect(validateInviteCode("  mana   crypt   flip ")).toBe(true)
  })

  it("rejects unknown invite codes", async () => {
    const { validateInviteCode } = await import("@/lib/inviteCodes")
    expect(validateInviteCode("")).toBe(false)
    expect(validateInviteCode("OPEN SESAME")).toBe(false)
  })

  it("uses VITE_INVITE_CODES when configured", async () => {
    vi.stubEnv("VITE_INVITE_CODES", "ISLAND GO,COUNTER TARGET SPELL")
    const { validateInviteCode } = await import("@/lib/inviteCodes")
    expect(validateInviteCode("island go")).toBe(true)
    expect(validateInviteCode("counter   target spell")).toBe(true)
    expect(validateInviteCode("BOLT THE BIRD")).toBe(false)
  })
})
