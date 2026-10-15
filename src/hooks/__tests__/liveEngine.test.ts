import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useLiveGame, commanderSourceLabel, type LiveConfig } from "@/live/engine"

function config(): LiveConfig {
  return {
    startingSeat: 1,
    players: [
      {
        id: "a",
        seatPosition: 1,
        isMe: true,
        displayName: "Alex",
        commanderName: "Tymna the Weaver",
        partnerName: "Thrasios, Triton Hero",
      },
      { id: "b", seatPosition: 2, isMe: false, displayName: "Bo", commanderName: "Atraxa, Praetors' Voice" },
    ],
  }
}

describe("live commander damage with partners", () => {
  it("tracks each partner toward 21 separately", () => {
    const { result } = renderHook(() => useLiveGame(config()))
    act(() => {
      result.current.applyDamage("b", 11, { sourceId: "a", isCommander: true, commanderSlot: 0 })
    })
    act(() => {
      result.current.applyDamage("b", 11, { sourceId: "a", isCommander: true, commanderSlot: 1 })
    })
    const rt = result.current.runtime.b
    expect(rt.commanderFrom).toEqual({ a: 11, "a:1": 11 })
    expect(rt.life).toBe(18)
    expect(rt.knockedOut).toBe(false)
  })

  it("knocks out at 21 from one partner", () => {
    const { result } = renderHook(() => useLiveGame(config()))
    act(() => {
      result.current.applyDamage("b", 21, { sourceId: "a", isCommander: true, commanderSlot: 1 })
    })
    expect(result.current.runtime.b.knockedOut).toBe(true)
  })

  it("undoes and replays partner damage against the right commander", () => {
    const { result } = renderHook(() => useLiveGame(config()))
    act(() => {
      result.current.applyDamage("b", 5, { sourceId: "a", isCommander: true, commanderSlot: 1 })
    })
    act(() => {
      result.current.applyDamage("b", 7, { sourceId: "a", isCommander: true })
    })
    act(() => result.current.undoLast())
    expect(result.current.runtime.b.commanderFrom).toEqual({ a: 0, "a:1": 5 })
    act(() => result.current.undoToIndex(1))
    expect(result.current.runtime.b.commanderFrom).toEqual({ "a:1": 5 })
  })

  it("labels damage sources by commander when a seat has two", () => {
    const players = config().players
    expect(commanderSourceLabel(players, "a:1")).toBe("Alex · Thrasios")
    expect(commanderSourceLabel(players, "a")).toBe("Alex · Tymna the Weaver")
    expect(commanderSourceLabel(players, "b")).toBe("Bo")
  })

  it("saves both commanders and a partner set mid-game", () => {
    const { result } = renderHook(() => useLiveGame(config()))
    act(() => {
      result.current.setPartner("b", { partnerName: "Kraum, Ludevic's Opus", partnerColorIdentity: ["U", "R"] })
    })
    const game = result.current.buildGame()
    expect(game.players.find((p) => p.id === "a")?.partnerName).toBe("Thrasios, Triton Hero")
    expect(game.players.find((p) => p.id === "b")).toMatchObject({
      partnerName: "Kraum, Ludevic's Opus",
      partnerColorIdentity: ["U", "R"],
    })
  })

  it("clears the partner when a solo commander replaces the deck", () => {
    const { result } = renderHook(() => useLiveGame(config()))
    act(() => {
      result.current.setCommander("a", { commanderName: "Atraxa, Praetors' Voice" })
    })
    expect(result.current.players.find((p) => p.id === "a")?.partnerName).toBeUndefined()
  })
})
