import type { Game, MtgColor, Player, SeatPosition } from "@/types"

/* Deterministic demo games that drive the logged-out app simulation and the
   onboarding walkthrough. These feed the *real* Dashboard / Stats / History
   pages, so both show exactly what the product renders — just with sample
   data. The anchor date is a parameter because the marketing page wants a
   fixed, reproducible history while the walkthrough wants games recent enough
   to land inside the stats page's date ranges. */

interface Cmdr {
  name: string
  colors: MtgColor[]
}

const ME_POOL: Cmdr[] = [
  { name: "Yuriko, the Tiger's Shadow", colors: ["U", "B"] },
  { name: "Korvold, Fae-Cursed King", colors: ["B", "R", "G"] },
  { name: "Krenko, Mob Boss", colors: ["R"] },
  { name: "Kinnan, Bonder Prodigy", colors: ["U", "G"] },
  { name: "Atraxa, Praetors' Voice", colors: ["W", "U", "B", "G"] },
]

const POD: { name: string; pool: Cmdr[] }[] = [
  {
    name: "Dave",
    pool: [
      { name: "Edgar Markov", colors: ["W", "B", "R"] },
      { name: "Najeela, the Blade-Blossom", colors: ["W", "U", "B", "R", "G"] },
    ],
  },
  {
    name: "Priya",
    pool: [
      { name: "Atraxa, Praetors' Voice", colors: ["W", "U", "B", "G"] },
      { name: "Kinnan, Bonder Prodigy", colors: ["U", "G"] },
    ],
  },
  {
    name: "Marisol",
    pool: [
      { name: "Krenko, Mob Boss", colors: ["R"] },
      { name: "Kenrith, the Returned King", colors: ["W", "U", "B", "R", "G"] },
    ],
  },
]

const WIN_CONDITIONS = ["Combat damage", "Commander damage", "Infinite combo", "Mill", "Aristocrats"]
const KEY_CARDS = ["Craterhoof Behemoth", "Thassa's Oracle", "Cyclonic Rift", "Dockside Extortionist", "Demonic Tutor"]
const FAST_MANA = ["Sol Ring", "Mana Crypt", "Mana Vault", "Jeweled Lotus"]

// Result pattern for "me" across the 22 games (newest first): ~32% win rate
// with a recent two-loss skid and an older win streak.
const ME_RESULTS = [
  false, true, true, false, false, true, false, false, true, false, false,
  true, false, false, true, true, false, false, true, false, false, false,
]

const FIXED_ANCHOR = new Date(2026, 5, 19)

export function buildDemoGames(anchor: Date = FIXED_ANCHOR): Game[] {
  function daysAgo(n: number): string {
    const d = new Date(anchor)
    d.setDate(d.getDate() - n)
    d.setHours(20, 30, 0, 0)
    return d.toISOString()
  }

  const games: Game[] = []
  let day = 1

  for (let i = 0; i < ME_RESULTS.length; i++) {
    const iWon = ME_RESULTS[i]
    const meCmdr = ME_POOL[i % ME_POOL.length]
    const meSeat = ((i % 4) + 1) as SeatPosition

    // Build the four seats: "me" plus the three pod-mates, rotated into place.
    const seatOrder: SeatPosition[] = [1, 2, 3, 4]
    const otherSeats = seatOrder.filter((s) => s !== meSeat)

    const players: Player[] = []
    const mePlayer: Player = {
      id: `demo-${i}-me`,
      isMe: true,
      commanderName: meCmdr.name,
      commanderColorIdentity: meCmdr.colors,
      seatPosition: meSeat,
      displayName: "You",
      fastMana: { hasFastMana: i % 5 === 0, cards: i % 5 === 0 ? [FAST_MANA[i % FAST_MANA.length]] : [] },
    }
    players.push(mePlayer)

    POD.forEach((mate, mIdx) => {
      const cmdr = mate.pool[(i + mIdx) % mate.pool.length]
      players.push({
        id: `demo-${i}-${mate.name}`,
        isMe: false,
        commanderName: cmdr.name,
        commanderColorIdentity: cmdr.colors,
        seatPosition: otherSeats[mIdx],
        displayName: mate.name,
        fastMana: {
          hasFastMana: (i + mIdx) % 3 === 0,
          cards: (i + mIdx) % 3 === 0 ? [FAST_MANA[(i + mIdx) % FAST_MANA.length]] : [],
        },
      })
    })

    players.sort((a, b) => a.seatPosition - b.seatPosition)

    // Winner: "me" when iWon, else Dave most often (the pod archenemy).
    let winner: Player
    if (iWon) {
      winner = mePlayer
    } else {
      const loserPool = players.filter((p) => !p.isMe)
      winner = i % 2 === 0 ? loserPool[0] : loserPool[(i % loserPool.length)]
    }

    const playerNames: Record<string, string> = {}
    for (const p of players) playerNames[p.id] = p.displayName!

    games.push({
      id: `demo-${i}`,
      playedAt: daysAgo(day),
      players,
      winnerId: winner.id,
      winTurn: 7 + ((i * 3) % 8),
      bracket: 2 + (i % 3),
      winConditions: [WIN_CONDITIONS[i % WIN_CONDITIONS.length]],
      keyWinconCards: [KEY_CARDS[i % KEY_CARDS.length], KEY_CARDS[(i + 2) % KEY_CARDS.length]],
      playerNames,
    })

    day += 3 + (i % 4)
  }

  return games
}

export const DEMO_GAMES: Game[] = buildDemoGames()
