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
// 40-game W/L pattern with deliberate win and loss streaks, plus one undefeated
// month (games 12-14) so the "flawless month" highlight fires.
const RESULTS = "WLWWLWLLWWWLWWWLWWLWWWLLWLWWLLLWLWWLWLWWW"

export function buildSampleGames(): Game[] {
  const games: Game[] = []
  // Three games per calendar month starting Oct 2025 — so the career crosses a
  // year boundary and each month maps cleanly to a 3-game block.
  const base = new Date(2025, 9, 1)

  for (let i = 0; i < RESULTS.length; i++) {
    // Bias toward Krenko (deck 0) so it reaches the 10- and 20-game veteran tiers.
    const deckIndex = i % 7 < 4 ? 0 : (i % 7) - 3
    const deck = MY_DECKS[deckIndex]
    const playerCount = 3 + (i % 2) // alternate 3- and 4-player pods
    const monthIndex = Math.floor(i / 3)
    const playedAt = new Date(base.getFullYear(), base.getMonth() + monthIndex, 5 + (i % 3) * 9, 19, 30)
    const meId = id(i * 100)
    const opponentNames = OPPONENTS.slice(i % 4, (i % 4) + playerCount - 1)
    const won = RESULTS[i] === "W"
    // win turns span fast kills (4-5) through grindy 12+ games
    const winTurn = won ? 4 + (i % 9) : 8 + (i % 3)
    const usedFastMana = i % 5 === 0
    const opponentHasFastMana = i % 4 === 2 // some pods race out a fast-mana start

    const me: Player = {
      id: meId,
      isMe: true,
      commanderName: deck.name,
      commanderColorIdentity: deck.colors,
      seatPosition: ((i % 4) + 1) as Player["seatPosition"], // cycle seats 1-4
      displayName: "You",
      knockoutTurn: won ? undefined : Math.max(3, winTurn - 3 - (i % 4)),
      fastMana: { hasFastMana: usedFastMana, cards: usedFastMana ? [FAST_MANA[i % FAST_MANA.length]] : [] },
    }

    const opponents: Player[] = opponentNames.map((name, j) => ({
      id: id(i * 100 + j + 1),
      isMe: false,
      commanderName: name,
      seatPosition: (j + 2) as Player["seatPosition"],
      displayName: name.split(/[ ,]/)[0],
      knockoutTurn: won ? winTurn - (j + 1) : undefined,
      fastMana:
        j === 0 && opponentHasFastMana
          ? { hasFastMana: true, cards: [FAST_MANA[(i + 1) % FAST_MANA.length]] }
          : { hasFastMana: false, cards: [] },
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
