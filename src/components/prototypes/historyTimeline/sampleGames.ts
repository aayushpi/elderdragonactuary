import type { Game, MtgColor, Player } from "@/types"

interface Deck {
  name: string
  colors: MtgColor[]
  bracket: number
  /** Cards this deck tends to win with — surfaced as "Closed with …". */
  wincons: string[]
  winCondition: string
}

const MY_DECKS: Deck[] = [
  {
    name: "Krenko, Mob Boss",
    colors: ["R"],
    bracket: 3,
    wincons: ["Impact Tremors", "Purphoros, God of the Forge", "Skullclamp"],
    winCondition: "Lethal Non-Combat Damage",
  },
  {
    name: "Lathril, Blade of the Elves",
    colors: ["B", "G"],
    bracket: 3,
    wincons: ["Craterhoof Behemoth", "Beastmaster Ascension", "Lathril, Blade of the Elves"],
    winCondition: "Lethal Combat Damage",
  },
  {
    name: "Yuriko, the Tiger's Shadow",
    colors: ["U", "B"],
    bracket: 4,
    wincons: ["Yuriko, the Tiger's Shadow", "Fireball", "Temporal Trespass"],
    winCondition: "Commander Damage",
  },
  {
    name: "Atraxa, Praetors' Voice",
    colors: ["W", "U", "B", "G"],
    bracket: 4,
    wincons: ["Thassa's Oracle", "Demonic Consultation", "Toxic Deluge"],
    winCondition: "Infinite Loop",
  },
]

const OPPONENTS = [
  "Edgar Markov",
  "Kaalia of the Vast",
  "Najeela, the Blade-Blossom",
  "Korvold, Fae-Cursed King",
  "Urza, Lord High Artificer",
  "Tymna the Weaver",
  "Prosper, Tome-Bound",
  "Magda, Brazen Outlaw",
]

const FAST_MANA = ["Sol Ring", "Mana Crypt", "Jeweled Lotus", "Mana Vault"]

function id(seed: number): string {
  return `proto-${seed.toString(36)}-${(seed * 7919).toString(36)}`
}

/**
 * Deterministic sample career used by the prototype harness when the signed-in
 * user has no real games yet. ~4 months of in-depth logs — win conditions, key
 * wincon cards, brackets, fast mana, knockouts — so the timeline highlights and
 * the heatmap have realistic material to surface.
 */
export function buildSampleGames(): Game[] {
  const games: Game[] = []
  const start = new Date("2026-02-08T19:30:00")
  // crafted to produce a debut, a first win, a 3-win streak, and a fast kill
  const wins = [false, true, false, true, true, true, false, false, true, false, true, false, true, true]
  const deckOrder = [0, 0, 1, 1, 0, 2, 2, 1, 0, 3, 3, 2, 0, 1]

  for (let i = 0; i < wins.length; i++) {
    const deck = MY_DECKS[deckOrder[i]]
    const playerCount = 3 + (i % 2) // alternate 3- and 4-player pods
    const playedAt = new Date(start.getTime() + i * 1000 * 60 * 60 * 24 * (5 + (i % 4)))
    const meId = id(i * 100)
    const opponentNames = OPPONENTS.slice(i % 4, (i % 4) + playerCount - 1)
    const won = wins[i]
    const winTurn = won ? 4 + (i % 5) : 8 + (i % 4)
    const usedFastMana = i % 3 === 0

    const me: Player = {
      id: meId,
      isMe: true,
      commanderName: deck.name,
      commanderColorIdentity: deck.colors,
      seatPosition: ((i % playerCount) + 1) as Player["seatPosition"],
      displayName: "You",
      knockoutTurn: won ? undefined : Math.max(3, winTurn - 3 - (i % 3)),
      fastMana: { hasFastMana: usedFastMana, cards: usedFastMana ? [FAST_MANA[i % FAST_MANA.length]] : [] },
    }

    const opponents: Player[] = opponentNames.map((name, j) => ({
      id: id(i * 100 + j + 1),
      isMe: false,
      commanderName: name,
      seatPosition: (j + 2) as Player["seatPosition"],
      displayName: name.split(/[ ,]/)[0],
      knockoutTurn: won ? winTurn - (j + 1) : undefined,
      fastMana: { hasFastMana: false, cards: [] },
    }))

    const players = [me, ...opponents]
    const winnerId = won ? meId : opponents[0].id

    games.push({
      id: id(i),
      playedAt: playedAt.toISOString(),
      players,
      winnerId,
      winTurn,
      bracket: deck.bracket,
      winConditions: won ? [deck.winCondition] : undefined,
      keyWinconCards: won ? [deck.wincons[i % deck.wincons.length]] : undefined,
    })
  }

  return games
}
