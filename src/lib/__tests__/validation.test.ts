import { describe, it, expect } from "vitest"
import { hasInvalidKoTiming } from "@/lib/validation"
import { makePlayer } from "./helpers"

describe("hasInvalidKoTiming", () => {
  it("returns true when all losers are KO'd before winning turn", () => {
    const winner = makePlayer({ id: "w", isMe: true })
    const loser1 = makePlayer({ id: "l1", knockoutTurn: 4 })
    const loser2 = makePlayer({ id: "l2", knockoutTurn: 5 })

    expect(hasInvalidKoTiming([winner, loser1, loser2], "w", "6")).toBe(true)
  })

  it("returns false when any loser has no KO turn", () => {
    const winner = makePlayer({ id: "w", isMe: true })
    const loser1 = makePlayer({ id: "l1", knockoutTurn: 4 })
    const loser2 = makePlayer({ id: "l2" })

    expect(hasInvalidKoTiming([winner, loser1, loser2], "w", "6")).toBe(false)
  })

  it("returns false when any loser KO turn is on winning turn", () => {
    const winner = makePlayer({ id: "w", isMe: true })
    const loser1 = makePlayer({ id: "l1", knockoutTurn: 6 })
    const loser2 = makePlayer({ id: "l2", knockoutTurn: 4 })

    expect(hasInvalidKoTiming([winner, loser1, loser2], "w", "6")).toBe(false)
  })

  it("returns false when winner or win turn are invalid", () => {
    const winner = makePlayer({ id: "w", isMe: true })
    const loser = makePlayer({ id: "l1", knockoutTurn: 4 })

    expect(hasInvalidKoTiming([winner, loser], null, "6")).toBe(false)
    expect(hasInvalidKoTiming([winner, loser], "w", "")).toBe(false)
    expect(hasInvalidKoTiming([winner, loser], "w", "0")).toBe(false)
  })
})
