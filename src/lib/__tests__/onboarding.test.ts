import { beforeEach, describe, expect, it } from "vitest"
import {
  ONBOARDING_VERSION,
  clearOnboarding,
  loadOnboarding,
  saveOnboarding,
  shouldShowOnboarding,
} from "@/lib/onboarding"

beforeEach(() => {
  localStorage.clear()
})

describe("onboarding state", () => {
  it("shows the tour when nothing has been stored", () => {
    expect(shouldShowOnboarding()).toBe(true)
    expect(loadOnboarding()).toBeNull()
  })

  it("stops showing the tour once completed", () => {
    saveOnboarding("completed")
    expect(shouldShowOnboarding()).toBe(false)
    expect(loadOnboarding()).toMatchObject({ status: "completed", version: ONBOARDING_VERSION })
  })

  it("stops showing the tour once skipped", () => {
    saveOnboarding("skipped")
    expect(shouldShowOnboarding()).toBe(false)
  })

  it("shows the tour again after a version bump", () => {
    localStorage.setItem(
      "commando_onboarding",
      JSON.stringify({ version: ONBOARDING_VERSION - 1, status: "completed", at: "" }),
    )
    expect(shouldShowOnboarding()).toBe(true)
  })

  it("ignores malformed stored state", () => {
    localStorage.setItem("commando_onboarding", "not json")
    expect(loadOnboarding()).toBeNull()
    expect(shouldShowOnboarding()).toBe(true)

    localStorage.setItem("commando_onboarding", JSON.stringify({ version: 1, status: "bogus" }))
    expect(loadOnboarding()).toBeNull()
  })

  it("clears stored state so the tour can be replayed", () => {
    saveOnboarding("completed")
    clearOnboarding()
    expect(shouldShowOnboarding()).toBe(true)
  })
})
