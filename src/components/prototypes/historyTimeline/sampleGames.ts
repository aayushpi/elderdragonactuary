import type { Game, MtgColor } from "@/types"

interface Deck {
  name: string
  colors: MtgColor[]
}

const MY_DECKS: Deck[] = [
  { name: "Atraxa, Praetors' Voice", colors: ["W", "U", "B", "G"] },
  { name: "Krenko, Mob Boss", colors: ["R"] },
  { name: "Yuriko, the Tiger's Shadow", colors: ["U", "B"] },
  { name: "Lathril, Blade of the Elves", colors: ["B", "G"] },
]

const OPPONENTS = [
  "Edgar Markov",
  "Kaalia of the Vast",
  "Najeela, the Blade-Blossom",
  "Korvold, Fae-Cursed King",
  "Urza, Lord High Artificer",
  "Tymna",
  "Prosper, Tome-Bound",
  "Magda, Brazen Outlaw",
]

function id(seed: number): string {
  return `proto-${seed.toString(36)}-${(seed * 7919).toString(36)}`
}

/**
 * Deterministic sample career used by the prototype harness when the signed-in
 * user has no real games yet. Spans ~4 months with streaks and deck debuts so
 * the timeline milestones have something to surface.
 */
export function buildSampleGames(): Game[] {
  const games: Game[] = []
  const start = new Date("2026-02-08T19:30:00")
  // win pattern crafted to produce a debut, a first win, and a 3-game streak
  const wins = [false, true, false, true, true, true, false, false, true, false, true, false, true, true]
  const deckOrder = [0, 0, 1, 1, 0, 2, 2, 1, 0, 3, 3, 2, 0, 1]

  for (let i = 0; i < wins.length; i++) {
    const deck = MY_DECKS[deckOrder[i]]
    const playerCount = 3 + (i % 2) // alternate 3 and 4 player pods
    const playedAt = new Date(start.getTime() + i * 1000 * 60 * 60 * 24 * (8 + (i % 3)))
    const meId = id(i * 100)
    const opponents = OPPONENTS.slice(i % 4, (i % 4) + playerCount - 1)

    const players = [
      {
        id: meId,
        isMe: true,
        commanderName: deck.name,
        commanderColorIdentity: deck.colors,
        seatPosition: ((i % playerCount) + 1) as Game["players"][number]["seatPosition"],
        displayName: "You",
        fastMana: { hasFastMana: i % 4 === 0, cards: i % 4 === 0 ? ["Sol Ring"] : [] },
      },
      ...opponents.map((name, j) => ({
        id: id(i * 100 + j + 1),
        isMe: false,
        commanderName: name,
        seatPosition: (j + 2) as Game["players"][number]["seatPosition"],
        displayName: name.split(/[ ,]/)[0],
        fastMana: { hasFastMana: false, cards: [] },
      })),
    ]

    const won = wins[i]
    const winnerId = won ? meId : players[1].id

    games.push({
      id: id(i),
      playedAt: playedAt.toISOString(),
      players,
      winnerId,
      winTurn: won ? 4 + (i % 6) : 7 + (i % 5),
      winConditions: won ? ["Combat damage"] : undefined,
    })
  }

  return games
}
