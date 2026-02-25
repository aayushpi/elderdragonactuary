import { describe, it, expect, beforeEach } from "vitest"
import { computeStats } from "@/lib/stats"
import { makeGame, makePlayer, resetIdCounter } from "./helpers"
import type { Game } from "@/types"

beforeEach(() => resetIdCounter())

// ─── Overall win rate ───────────────────────────────────────────────────────

describe("overall win rate", () => {
  it("returns zeroes for empty game list", () => {
    const stats = computeStats([])
    expect(stats.overall).toEqual({ wins: 0, games: 0, rate: 0 })
    expect(stats.gamesPlayed).toBe(0)
  })

  it("computes correct rate for mixed wins/losses", () => {
    const me1 = makePlayer({ isMe: true, commanderName: "Atraxa" })
    const me2 = makePlayer({ isMe: true, commanderName: "Atraxa" })
    const me3 = makePlayer({ isMe: true, commanderName: "Atraxa" })
    const opp = makePlayer({ commanderName: "Korvold" })

    const games: Game[] = [
      makeGame({ players: [me1, opp], winnerId: me1.id, winTurn: 7 }),
      makeGame({ players: [me2, opp], winnerId: me2.id, winTurn: 9 }),
      makeGame({ players: [me3, opp], winnerId: opp.id, winTurn: 6 }),
    ]

    const stats = computeStats(games)
    expect(stats.overall.wins).toBe(2)
    expect(stats.overall.games).toBe(3)
    expect(stats.overall.rate).toBeCloseTo(2 / 3)
    expect(stats.gamesPlayed).toBe(3)
  })

  it("excludes games where no player has isMe true", () => {
    const p1 = makePlayer({ commanderName: "Korvold" })
    const p2 = makePlayer({ commanderName: "Atraxa" })
    const games: Game[] = [
      makeGame({ players: [p1, p2], winnerId: p1.id }),
    ]
    const stats = computeStats(games)
    expect(stats.overall.games).toBe(0)
  })
})

// ─── Fast mana win rates ────────────────────────────────────────────────────

describe("fast mana win rates", () => {
  it("with fast mana: counts only games where I had fast mana", () => {
    const me1 = makePlayer({ isMe: true, hasFastMana: true, fastManaCards: ["Sol Ring"] })
    const me2 = makePlayer({ isMe: true, hasFastMana: false })
    const opp = makePlayer()

    const games: Game[] = [
      makeGame({ players: [me1, opp], winnerId: me1.id, winTurn: 5 }),
      makeGame({ players: [me2, opp], winnerId: opp.id, winTurn: 10 }),
    ]

    const stats = computeStats(games)
    expect(stats.withFastMana.games).toBe(1)
    expect(stats.withFastMana.wins).toBe(1)
    expect(stats.withFastMana.rate).toBe(1)
  })

  it("against fast mana: counts games where an opponent had fast mana", () => {
    const me = makePlayer({ isMe: true })
    const oppFast = makePlayer({ hasFastMana: true, fastManaCards: ["Mana Crypt"] })
    const oppNoFast = makePlayer({ hasFastMana: false })

    const games: Game[] = [
      makeGame({ players: [me, oppFast], winnerId: me.id, winTurn: 8 }),
      makeGame({ players: [me, oppNoFast], winnerId: me.id, winTurn: 10 }),
    ]

    const stats = computeStats(games)
    expect(stats.againstFastMana.games).toBe(1)
    expect(stats.againstFastMana.wins).toBe(1)
  })

  it("zero fast-mana games yields rate 0", () => {
    const me = makePlayer({ isMe: true })
    const opp = makePlayer()
    const stats = computeStats([makeGame({ players: [me, opp], winnerId: me.id })])
    expect(stats.withFastMana).toEqual({ wins: 0, games: 0, rate: 0 })
  })
})

// ─── Per-seat win rates ─────────────────────────────────────────────────────

describe("per-seat win rates", () => {
  it("all 6 seat keys are present, even with no games", () => {
    const stats = computeStats([])
    for (let i = 1; i <= 6; i++) {
      const key = `seat${i}` as keyof typeof stats.bySeat
      expect(stats.bySeat[key]).toEqual({ wins: 0, games: 0, rate: 0 })
    }
  })

  it("correctly buckets wins by seat position", () => {
    const me1 = makePlayer({ isMe: true, seatPosition: 1 })
    const me2 = makePlayer({ isMe: true, seatPosition: 3 })
    const opp = makePlayer()

    const games: Game[] = [
      makeGame({ players: [me1, opp], winnerId: me1.id, winTurn: 7 }),
      makeGame({ players: [me2, opp], winnerId: opp.id, winTurn: 6 }),
    ]

    const stats = computeStats(games)
    expect(stats.bySeat.seat1).toEqual({ wins: 1, games: 1, rate: 1 })
    expect(stats.bySeat.seat3).toEqual({ wins: 0, games: 1, rate: 0 })
    expect(stats.bySeat.seat2).toEqual({ wins: 0, games: 0, rate: 0 })
  })
})

// ─── Per-commander aggregation ──────────────────────────────────────────────

describe("per-commander stats", () => {
  it("aggregates wins, games, and average win turn per commander", () => {
    const me1 = makePlayer({ isMe: true, commanderName: "Atraxa" })
    const me2 = makePlayer({ isMe: true, commanderName: "Atraxa" })
    const me3 = makePlayer({ isMe: true, commanderName: "Atraxa" })
    const opp = makePlayer({ commanderName: "Korvold" })

    const games: Game[] = [
      makeGame({ players: [me1, opp], winnerId: me1.id, winTurn: 6 }),
      makeGame({ players: [me2, opp], winnerId: me2.id, winTurn: 10 }),
      makeGame({ players: [me3, opp], winnerId: opp.id, winTurn: 5 }),
    ]

    const stats = computeStats(games)
    const atraxa = stats.byCommander.find((c) => c.name === "Atraxa")!
    expect(atraxa.wins).toBe(2)
    expect(atraxa.games).toBe(3)
    expect(atraxa.rate).toBeCloseTo(2 / 3)
    expect(atraxa.averageWinTurn).toBe(8) // (6+10)/2
  })

  it("averageWinTurn is null when commander has 0 wins", () => {
    const me = makePlayer({ isMe: true, commanderName: "Zedruu" })
    const opp = makePlayer({ commanderName: "Korvold" })
    const games: Game[] = [
      makeGame({ players: [me, opp], winnerId: opp.id, winTurn: 5 }),
    ]
    const stats = computeStats(games)
    const zedruu = stats.byCommander.find((c) => c.name === "Zedruu")!
    expect(zedruu.averageWinTurn).toBeNull()
  })

  it("recentResults capped at 10, ordered newest first", () => {
    const opp = makePlayer({ commanderName: "Korvold" })
    const games: Game[] = Array.from({ length: 15 }, (_, i) => {
      const me = makePlayer({ isMe: true, commanderName: "Atraxa" })
      return makeGame({
        players: [me, opp],
        winnerId: me.id,
        winTurn: 7,
        playedAt: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      })
    })

    const stats = computeStats(games)
    const atraxa = stats.byCommander.find((c) => c.name === "Atraxa")!
    expect(atraxa.recentResults).toHaveLength(10)
    // Newest first
    expect(atraxa.recentResults[0].date).toBe("2025-01-15T00:00:00.000Z")
  })

  it("recentResults winningCommander shows the winner's commander name", () => {
    const me = makePlayer({ isMe: true, commanderName: "Atraxa" })
    const opp = makePlayer({ commanderName: "Korvold" })
    const games: Game[] = [
      makeGame({ players: [me, opp], winnerId: opp.id, winTurn: 5 }),
    ]
    const stats = computeStats(games)
    const atraxa = stats.byCommander.find((c) => c.name === "Atraxa")!
    expect(atraxa.recentResults[0].result).toBe("L")
    expect(atraxa.recentResults[0].winningCommander).toBe("Korvold")
  })

  it("keyCards aggregated and sorted by count desc then alphabetical, capped at 5", () => {
    const opp = makePlayer({ commanderName: "Korvold" })
    const games: Game[] = []
    // Create 6 different cards, one appearing 3 times, rest once
    const cardSets = [
      ["Thoracle", "Demonic Consultation"],
      ["Thoracle", "Ad Nauseam"],
      ["Thoracle", "Aetherflux Reservoir"],
      ["Brain Freeze"],
      ["Cyclonic Rift"],
      ["Windfall"],
    ]
    for (const cards of cardSets) {
      const me = makePlayer({ isMe: true, commanderName: "Atraxa" })
      games.push(makeGame({
        players: [me, opp],
        winnerId: me.id,
        winTurn: 7,
        keyWinconCards: cards,
      }))
    }

    const stats = computeStats(games)
    const atraxa = stats.byCommander.find((c) => c.name === "Atraxa")!
    expect(atraxa.keyCards.length).toBeLessThanOrEqual(5)
    expect(atraxa.keyCards[0].name).toBe("Thoracle")
    expect(atraxa.keyCards[0].count).toBe(3)
    // Remaining cards appear once each; alphabetical tie-break
    const singleCountCards = atraxa.keyCards.slice(1).map((c) => c.name)
    const sorted = [...singleCountCards].sort()
    expect(singleCountCards).toEqual(sorted)
  })

  it("byCommander sorted by rate desc, then games desc", () => {
    const opp = makePlayer({ commanderName: "Korvold" })
    // Commander A: 1/1 = 100%
    const meA = makePlayer({ isMe: true, commanderName: "A" })
    // Commander B: 2/3 ≈ 67%
    const meB1 = makePlayer({ isMe: true, commanderName: "B" })
    const meB2 = makePlayer({ isMe: true, commanderName: "B" })
    const meB3 = makePlayer({ isMe: true, commanderName: "B" })

    const games: Game[] = [
      makeGame({ players: [meA, opp], winnerId: meA.id, winTurn: 5 }),
      makeGame({ players: [meB1, opp], winnerId: meB1.id, winTurn: 6 }),
      makeGame({ players: [meB2, opp], winnerId: meB2.id, winTurn: 7 }),
      makeGame({ players: [meB3, opp], winnerId: opp.id, winTurn: 4 }),
    ]

    const stats = computeStats(games)
    expect(stats.byCommander[0].name).toBe("A")
    expect(stats.byCommander[1].name).toBe("B")
  })
})

// ─── Color identity ─────────────────────────────────────────────────────────

describe("commander color identity stats", () => {
  it("groups games by normalized color identity", () => {
    const opp = makePlayer({ commanderName: "Korvold" })
    // Two different commanders with same color identity (UB)
    const me1 = makePlayer({ isMe: true, commanderName: "Dimir A", commanderColorIdentity: ["B", "U"] })
    const me2 = makePlayer({ isMe: true, commanderName: "Dimir B", commanderColorIdentity: ["U", "B"] })

    const games: Game[] = [
      makeGame({ players: [me1, opp], winnerId: me1.id, winTurn: 7 }),
      makeGame({ players: [me2, opp], winnerId: opp.id, winTurn: 5 }),
    ]

    const stats = computeStats(games)
    const ub = stats.byCommanderColorIdentity.find((c) => c.key === "UB")!
    expect(ub.games).toBe(2)
    expect(ub.wins).toBe(1)
    expect(ub.uniqueCommanders).toBe(2)
    expect(ub.winRate).toBe(0.5)
    expect(ub.lossRate).toBe(0.5)
  })

  it("uses 'C' key for colorless / undefined color identity", () => {
    const me = makePlayer({ isMe: true, commanderName: "Kozilek" })
    const opp = makePlayer({ commanderName: "Atraxa" })
    const games: Game[] = [
      makeGame({ players: [me, opp], winnerId: me.id, winTurn: 8 }),
    ]
    const stats = computeStats(games)
    const colorless = stats.byCommanderColorIdentity.find((c) => c.key === "C")!
    expect(colorless).toBeDefined()
    expect(colorless.games).toBe(1)
  })

  it("mostPlayed, mostSuccessful, archnemesis are null with 0 games", () => {
    const stats = computeStats([])
    expect(stats.mostPlayedCommanderColorIdentity).toBeNull()
    expect(stats.mostSuccessfulCommanderColorIdentity).toBeNull()
    expect(stats.archnemesisCommanderColorIdentity).toBeNull()
  })

  it("identifies most played and most successful color identities", () => {
    const opp = makePlayer({ commanderName: "Korvold" })
    // 3 games with WU (1 win), 1 game with BR (1 win)
    const games: Game[] = [
      makeGame({ players: [makePlayer({ isMe: true, commanderName: "A", commanderColorIdentity: ["W", "U"] }), opp], winnerId: opp.id, winTurn: 5 }),
      makeGame({ players: [makePlayer({ isMe: true, commanderName: "A", commanderColorIdentity: ["W", "U"] }), opp], winnerId: opp.id, winTurn: 5 }),
    ]
    const me3 = makePlayer({ isMe: true, commanderName: "A", commanderColorIdentity: ["W", "U"] })
    games.push(makeGame({ players: [me3, opp], winnerId: me3.id, winTurn: 7 }))
    const me4 = makePlayer({ isMe: true, commanderName: "B", commanderColorIdentity: ["B", "R"] })
    games.push(makeGame({ players: [me4, opp], winnerId: me4.id, winTurn: 6 }))

    const stats = computeStats(games)
    expect(stats.mostPlayedCommanderColorIdentity!.key).toBe("WU")
    expect(stats.mostSuccessfulCommanderColorIdentity!.key).toBe("BR")
  })
})

// ─── Average win turn (overall) ─────────────────────────────────────────────

describe("average win turn", () => {
  it("is null when no wins", () => {
    const me = makePlayer({ isMe: true })
    const opp = makePlayer()
    const stats = computeStats([
      makeGame({ players: [me, opp], winnerId: opp.id, winTurn: 5 }),
    ])
    expect(stats.averageWinTurn).toBeNull()
  })

  it("averages win turns across all my wins", () => {
    const opp = makePlayer()
    const me1 = makePlayer({ isMe: true })
    const me2 = makePlayer({ isMe: true })
    const games: Game[] = [
      makeGame({ players: [me1, opp], winnerId: me1.id, winTurn: 6 }),
      makeGame({ players: [me2, opp], winnerId: me2.id, winTurn: 10 }),
    ]
    const stats = computeStats(games)
    expect(stats.averageWinTurn).toBe(8)
  })
})

// ─── Top win conditions ─────────────────────────────────────────────────────

describe("top win conditions", () => {
  it("counts win conditions only from games I won", () => {
    const opp = makePlayer()
    const me1 = makePlayer({ isMe: true })
    const me2 = makePlayer({ isMe: true })
    const games: Game[] = [
      makeGame({ players: [me1, opp], winnerId: me1.id, winTurn: 7, winConditions: ["Combat"] }),
      makeGame({ players: [me2, opp], winnerId: opp.id, winTurn: 5, winConditions: ["Combo"] }),
    ]
    const stats = computeStats(games)
    expect(stats.topWinConditions).toEqual([{ condition: "Combat", count: 1 }])
  })

  it("sorts by count desc then alphabetical", () => {
    const opp = makePlayer()
    const games: Game[] = []
    for (let i = 0; i < 3; i++) {
      const me = makePlayer({ isMe: true })
      games.push(makeGame({ players: [me, opp], winnerId: me.id, winTurn: 7, winConditions: ["Combo"] }))
    }
    for (const cond of ["Combat", "Attrition"]) {
      const me = makePlayer({ isMe: true })
      games.push(makeGame({ players: [me, opp], winnerId: me.id, winTurn: 7, winConditions: [cond] }))
    }
    const stats = computeStats(games)
    expect(stats.topWinConditions[0]).toEqual({ condition: "Combo", count: 3 })
    expect(stats.topWinConditions[1].condition).toBe("Attrition")
    expect(stats.topWinConditions[2].condition).toBe("Combat")
  })

  it("caps at 5 conditions", () => {
    const opp = makePlayer()
    const conditions = ["A", "B", "C", "D", "E", "F", "G"]
    const games: Game[] = conditions.map((cond) => {
      const me = makePlayer({ isMe: true })
      return makeGame({ players: [me, opp], winnerId: me.id, winTurn: 7, winConditions: [cond] })
    })
    const stats = computeStats(games)
    expect(stats.topWinConditions).toHaveLength(5)
  })

  it("skips games with no winConditions", () => {
    const opp = makePlayer()
    const me = makePlayer({ isMe: true })
    const games: Game[] = [
      makeGame({ players: [me, opp], winnerId: me.id, winTurn: 7 }),
    ]
    const stats = computeStats(games)
    expect(stats.topWinConditions).toEqual([])
  })
})
