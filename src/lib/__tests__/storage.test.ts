import { describe, it, expect, beforeEach, vi } from "vitest"
import { makeGame, makePlayer, resetIdCounter } from "./helpers"

// Mock localStorage before importing storage module
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get _store() { return store },
  }
})()

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock })

import { loadGames, saveGames, exportData, exportCSV, importData, parseImportJson } from "@/lib/storage"

beforeEach(() => {
  localStorageMock.clear()
  resetIdCounter()
})

// ─── loadGames / saveGames ──────────────────────────────────────────────────

describe("loadGames / saveGames", () => {
  it("returns empty array when nothing stored", () => {
    expect(loadGames()).toEqual([])
  })

  it("roundtrips games through localStorage", () => {
    const game = makeGame({ winTurn: 7 })
    saveGames([game])
    const loaded = loadGames()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(game.id)
  })

  it("returns empty array on corrupted data", () => {
    localStorageMock.setItem("commando_games", "not json")
    expect(loadGames()).toEqual([])
  })
})

// ─── exportData / importData roundtrip ──────────────────────────────────────

describe("exportData / importData roundtrip", () => {
  it("export then import preserves game data (modulo IDs)", () => {
    const me = makePlayer({ isMe: true, commanderName: "Atraxa", seatPosition: 2, hasFastMana: true, fastManaCards: ["Sol Ring"] })
    const opp = makePlayer({ commanderName: "Korvold", seatPosition: 1, knockoutTurn: 6 })
    const game = makeGame({
      players: [me, opp],
      winnerId: me.id,
      winTurn: 7,
      notes: "Close game",
      winConditions: ["Combo"],
      keyWinconCards: ["Thoracle"],
      bracket: 3,
    })
    saveGames([game])

    const exported = exportData()
    localStorageMock.clear()

    const result = importData(exported)
    expect(result.success).toBe(true)
    expect(result.count).toBe(1)

    const imported = loadGames()
    expect(imported).toHaveLength(1)
    expect(imported[0].winTurn).toBe(7)
    expect(imported[0].notes).toBe("Close game")
    expect(imported[0].winConditions).toEqual(["Combo"])
    expect(imported[0].keyWinconCards).toEqual(["Thoracle"])
    expect(imported[0].bracket).toBe(3)
    // Player order preserved
    expect(imported[0].players[0].commanderName).toBe("Atraxa")
    expect(imported[0].players[0].isMe).toBe(true)
    expect(imported[0].players[1].commanderName).toBe("Korvold")
    expect(imported[0].players[1].knockoutTurn).toBe(6)
    // WinnerId maps to correct player
    expect(imported[0].winnerId).toBe(imported[0].players[0].id)
  })

  it("backup JSON from exportData is restorable via parseImportJson", () => {
    const me = makePlayer({ isMe: true, commanderName: "Najeela", seatPosition: 1, hasFastMana: true, fastManaCards: ["Mana Crypt"] })
    const opp = makePlayer({ commanderName: "Kinnan", seatPosition: 2, knockoutTurn: 5 })
    const game = makeGame({
      playedAt: "2026-02-25T12:34:56.000Z",
      players: [me, opp],
      winnerId: me.id,
      winTurn: 6,
      notes: "Backup restore regression",
      winConditions: ["Combo"],
      keyWinconCards: ["Thassa's Oracle"],
      bracket: 4,
    })
    saveGames([game])

    const backupJson = exportData()
    const parsed = parseImportJson(backupJson)

    expect(parsed.success).toBe(true)
    expect(parsed.games).toHaveLength(1)
    expect(parsed.games[0].winTurn).toBe(6)
    expect(parsed.games[0].notes).toBe("Backup restore regression")
    expect(parsed.games[0].winConditions).toEqual(["Combo"])
    expect(parsed.games[0].keyWinconCards).toEqual(["Thassa's Oracle"])
    expect(parsed.games[0].bracket).toBe(4)
    expect(parsed.games[0].players[0].isMe).toBe(true)
    expect(parsed.games[0].winnerId).toBe(parsed.games[0].players[0].id)
  })

  it("backup JSON from exportData can be fully restored with importData", () => {
    const me = makePlayer({ isMe: true, commanderName: "Atraxa", seatPosition: 1 })
    const opp = makePlayer({ commanderName: "Korvold", seatPosition: 2 })
    saveGames([makeGame({ players: [me, opp], winnerId: opp.id, winTurn: 9, notes: "restore all" })])

    const backupJson = exportData()
    localStorageMock.clear()

    const result = importData(backupJson)
    expect(result.success).toBe(true)
    expect(result.count).toBe(1)

    const restored = loadGames()
    expect(restored).toHaveLength(1)
    expect(restored[0].notes).toBe("restore all")
    expect(restored[0].players[1].commanderName).toBe("Korvold")
    expect(restored[0].winnerId).toBe(restored[0].players[1].id)
  })
})

// ─── importData — clean format ──────────────────────────────────────────────

describe("importData clean format", () => {
  it("sets isMe only on index 0", () => {
    const data = JSON.stringify({
      exportedAt: "2025-06-01",
      games: [{
        playedAt: "2025-06-01",
        winTurn: 5,
        winnerIndex: 1,
        players: [
          { commanderName: "A", seatPosition: 1, fastMana: { hasFastMana: false, cards: [] } },
          { commanderName: "B", seatPosition: 2, fastMana: { hasFastMana: false, cards: [] } },
        ],
      }],
    })
    importData(data)
    const games = loadGames()
    expect(games[0].players[0].isMe).toBe(true)
    expect(games[0].players[1].isMe).toBe(false)
    // Winner is player at index 1
    expect(games[0].winnerId).toBe(games[0].players[1].id)
  })

  it("handles optional fields being absent", () => {
    const data = JSON.stringify({
      exportedAt: "2025-06-01",
      games: [{
        playedAt: "2025-06-01",
        winTurn: 8,
        winnerIndex: 0,
        players: [
          { commanderName: "A", seatPosition: 1, fastMana: { hasFastMana: false, cards: [] } },
        ],
      }],
    })
    importData(data)
    const games = loadGames()
    expect(games[0].notes).toBeUndefined()
    expect(games[0].winConditions).toBeUndefined()
    expect(games[0].keyWinconCards).toBeUndefined()
    expect(games[0].bracket).toBeUndefined()
  })
})

// ─── importData — error handling ────────────────────────────────────────────

describe("importData error handling", () => {
  it("rejects non-JSON string", () => {
    const result = importData("not json at all")
    expect(result.success).toBe(false)
    expect(result.error).toBe("Invalid JSON.")
  })

  it("rejects JSON that is not an array or { games: [] }", () => {
    const result = importData(JSON.stringify({ foo: "bar" }))
    expect(result.success).toBe(false)
    expect(result.error).toContain("Invalid format")
  })
})

// ─── exportCSV ──────────────────────────────────────────────────────────────

describe("exportCSV", () => {
  it("produces header row with correct player columns", () => {
    const me = makePlayer({ isMe: true, commanderName: "Atraxa", seatPosition: 1 })
    const opp1 = makePlayer({ commanderName: "Korvold", seatPosition: 2 })
    const opp2 = makePlayer({ commanderName: "Tymna", seatPosition: 3 })
    saveGames([makeGame({ players: [me, opp1, opp2], winnerId: me.id, winTurn: 7 })])

    const csv = exportCSV()
    const header = csv.split("\n")[0]
    expect(header).toContain("Player 1 Commander")
    expect(header).toContain("Player 3 Commander")
    expect(header).toContain("Player 2 KO Turn")
  })

  it("includes per-player knockout turns", () => {
    const me = makePlayer({ isMe: true, commanderName: "Atraxa", seatPosition: 1 })
    const opp = makePlayer({ commanderName: "Korvold", seatPosition: 2, knockoutTurn: 6 })
    saveGames([makeGame({ players: [me, opp], winnerId: me.id, winTurn: 7 })])

    const csv = exportCSV()
    expect(csv).toContain(",6,")
  })

  it("renders partner commanders as Name // Partner", () => {
    const me = makePlayer({
      isMe: true,
      commanderName: "Tymna",
      partnerName: "Thrasios",
      seatPosition: 1,
    })
    const opp = makePlayer({ commanderName: "Korvold", seatPosition: 2 })
    saveGames([makeGame({ players: [me, opp], winnerId: me.id, winTurn: 7 })])

    const csv = exportCSV()
    expect(csv).toContain("Tymna // Thrasios")
  })

  it("escapes cells with commas", () => {
    const me = makePlayer({ isMe: true, commanderName: "Atraxa", seatPosition: 1 })
    const opp = makePlayer({ commanderName: "Korvold", seatPosition: 2 })
    saveGames([makeGame({
      players: [me, opp],
      winnerId: me.id,
      winTurn: 7,
      notes: "Game was close, very intense",
    })])

    const csv = exportCSV()
    // The notes cell should be quoted since it contains a comma
    expect(csv).toContain('"Game was close, very intense"')
  })
})
