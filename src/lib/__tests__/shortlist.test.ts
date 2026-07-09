import { describe, it, expect } from "vitest"
import { buildWinconShortlist, matchScore } from "@/lib/shortlist"
import { makeGame } from "./helpers"

describe("buildWinconShortlist", () => {
  it("returns empty for games without wincon cards", () => {
    expect(buildWinconShortlist([makeGame()])).toEqual([])
  })

  it("aggregates usage counts and orders most used first", () => {
    const games = [
      makeGame({ playedAt: "2025-06-01T00:00:00.000Z", keyWinconCards: ["Thassa's Oracle", "Demonic Consultation"] }),
      makeGame({ playedAt: "2025-06-05T00:00:00.000Z", keyWinconCards: ["Thassa's Oracle"] }),
      makeGame({ playedAt: "2025-06-10T00:00:00.000Z", keyWinconCards: ["Craterhoof Behemoth"] }),
    ]
    const list = buildWinconShortlist(games)
    expect(list.map((i) => i.name)).toEqual([
      "Thassa's Oracle",
      "Craterhoof Behemoth",
      "Demonic Consultation",
    ])
    expect(list[0].games).toBe(2)
    expect(list[0].lastPlayedISO).toBe("2025-06-05T00:00:00.000Z")
  })

  it("breaks usage ties by recency", () => {
    const games = [
      makeGame({ playedAt: "2025-06-01T00:00:00.000Z", keyWinconCards: ["Exsanguinate"] }),
      makeGame({ playedAt: "2025-06-08T00:00:00.000Z", keyWinconCards: ["Torment of Hailfire"] }),
    ]
    expect(buildWinconShortlist(games).map((i) => i.name)).toEqual([
      "Torment of Hailfire",
      "Exsanguinate",
    ])
  })
})

describe("matchScore", () => {
  it("matches partial and out-of-order tokens", () => {
    expect(matchScore("Thassa's Oracle", "oracle")).not.toBeNull()
    expect(matchScore("Thassa's Oracle", "oracle thas")).not.toBeNull()
  })

  it("returns null when a token is missing", () => {
    expect(matchScore("Thassa's Oracle", "craterhoof")).toBeNull()
    expect(matchScore("Thassa's Oracle", "")).toBeNull()
  })

  it("prefers earlier matches", () => {
    const early = matchScore("Craterhoof Behemoth", "crater")!
    const late = matchScore("Behemoth of Craterhoof", "crater")!
    expect(early).toBeLessThan(late)
  })
})
