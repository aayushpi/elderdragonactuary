import type { Game, MtgColor, Player } from "@/types"

// ── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneKind =
  | "first-game"
  | "milestone-game"
  | "debut"
  | "veteran"
  | "first-win"
  | "win"
  | "streak"
  | "fast-win"
  | "slow-burn"
  | "wincon"
  | "tough-seat"
  | "underdog"
  | "nemesis"
  | "new-rival"
  | "comeback"
  | "color-pioneer"
  | "bracket-buster"
  | "flawless-month"
  | "knockout"
  | "loss-streak"

export interface Milestone {
  kind: MilestoneKind
  /** Headline, e.g. "5th career win". */
  label: string
  /** Supporting context, e.g. "Krenko, Mob Boss". */
  detail?: string
  /** Optional icon-name override (otherwise the kind's default icon is used). */
  iconName?: string
}

/** Per-commander play-count tiers — "veteran status" for a deck you keep bringing. */
const VETERAN_TIERS: { n: number; iconName: string; detail: string }[] = [
  { n: 10, iconName: "Sprout", detail: "Getting comfortable" },
  { n: 20, iconName: "Star", detail: "Seasoned pilot" },
  { n: 50, iconName: "Medal", detail: "Grizzled veteran" },
  { n: 100, iconName: "Gem", detail: "True master" },
]

const COLOR_NAMES: Record<MtgColor, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
}
const WUBRG: MtgColor[] = ["W", "U", "B", "R", "G"]

function colorIdentityKey(colors: MtgColor[]): string {
  if (colors.length === 0) return "C"
  return WUBRG.filter((c) => colors.includes(c)).join("")
}

function colorIdentityLabel(colors: MtgColor[]): string {
  if (colors.length === 0) return "Colorless"
  if (colors.length === 5) return "5-Color"
  if (colors.length === 1) return `Mono-${COLOR_NAMES[colors[0]]}`
  return WUBRG.filter((c) => colors.includes(c)).join("")
}

export interface TimelineEvent {
  game: Game
  me?: Player
  won: boolean
  date: Date
  /** 1-based index of this game in the user's career (chronological). */
  careerIndex: number
  /** 1-based win number, or null for a loss. */
  winNumber: number | null
  milestones: Milestone[]
}

const GAME_LANDMARKS = new Set([10, 25, 50, 75, 100, 150, 200, 250, 500])
const WIN_LANDMARKS = new Set([5, 10, 25, 50, 75, 100, 150, 200])

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Walk games chronologically to derive career milestones (firsts, win/game
 * landmarks, streaks, debuts, fast kills, signature wincons), then return events
 * newest-first for display.
 */
export function buildTimeline(games: Game[]): TimelineEvent[] {
  const chrono = [...games].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  )

  // Per-month aggregate (chronological, so lastId ends up being the closing game).
  const monthAgg = new Map<string, { count: number; wins: number; lastId: string; label: string }>()
  for (const g of chrono) {
    const d = new Date(g.playedAt)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const me = g.players.find((p) => p.isMe)
    const won = !!me && g.winnerId === me.id
    const cur = monthAgg.get(key) ?? {
      count: 0,
      wins: 0,
      lastId: g.id,
      label: d.toLocaleDateString(undefined, { month: "long" }),
    }
    cur.count += 1
    if (won) cur.wins += 1
    cur.lastId = g.id
    monthAgg.set(key, cur)
  }

  const commanderPlays = new Map<string, number>()
  const beatenByCount = new Map<string, number>() // opponent commander → times they've beaten me
  const seenOpponents = new Set<string>()
  const wonColorIdentities = new Set<string>()
  let winCount = 0
  let streak = 0
  let lossStreak = 0
  let bracketSum = 0
  let bracketCount = 0

  const events: TimelineEvent[] = chrono.map((game, i) => {
    const me = game.players.find((p) => p.isMe)
    const won = !!me && game.winnerId === me.id
    const careerIndex = i + 1
    const cmdr = shortCommander(me?.commanderName)
    const date = new Date(game.playedAt)
    const opponents = game.players.filter((p) => !p.isMe)
    const priorBracketAvg = bracketCount > 0 ? bracketSum / bracketCount : null
    const milestones: Milestone[] = []

    const playCount = (commanderPlays.get(me?.commanderName ?? "") ?? 0) + 1
    if (me?.commanderName) commanderPlays.set(me.commanderName, playCount)

    if (careerIndex === 1) {
      milestones.push({ kind: "first-game", label: "First game logged", detail: cmdr })
    } else if (GAME_LANDMARKS.has(careerIndex)) {
      milestones.push({ kind: "milestone-game", label: `${ordinal(careerIndex)} game played`, detail: cmdr })
    }

    if (me?.commanderName && playCount === 1 && careerIndex > 1) {
      milestones.push({ kind: "debut", label: `${cmdr} debut`, detail: "First time piloting this deck" })
    }
    const tier = VETERAN_TIERS.find((t) => t.n === playCount)
    if (tier && me?.commanderName) {
      milestones.push({ kind: "veteran", iconName: tier.iconName, label: `${ordinal(playCount)} game with ${cmdr}`, detail: tier.detail })
    }

    // New rival — first ever game against a newly-seen opponent.
    if (careerIndex > 1) {
      const newcomer = opponents.find((o) => !seenOpponents.has(o.commanderName))
      if (newcomer) {
        milestones.push({ kind: "new-rival", label: "New rival", detail: shortCommander(newcomer.commanderName) })
      }
    }
    for (const o of opponents) seenOpponents.add(o.commanderName)

    let winNumber: number | null = null
    if (won) {
      const slump = lossStreak // capture before reset
      winCount += 1
      winNumber = winCount
      streak += 1
      lossStreak = 0

      if (winCount === 1) {
        milestones.push({ kind: "first-win", label: "First win", detail: cmdr })
      } else if (WIN_LANDMARKS.has(winCount)) {
        milestones.push({ kind: "win", label: `${ordinal(winCount)} career win`, detail: cmdr })
      }

      if (streak >= 2) {
        milestones.push({ kind: "streak", label: `${streak}-win streak` })
      }
      if (slump >= 3) {
        milestones.push({ kind: "comeback", label: "Comeback win", detail: `Snapped a ${slump}-loss slump` })
      }

      // Nemesis — beat an opponent who has beaten you 3+ times.
      let nemesis: string | undefined
      let nemesisCount = 0
      for (const o of opponents) {
        const c = beatenByCount.get(o.commanderName) ?? 0
        if (c >= 3 && c > nemesisCount) {
          nemesis = o.commanderName
          nemesisCount = c
        }
      }
      if (nemesis) {
        milestones.push({ kind: "nemesis", label: "Nemesis slain", detail: `${shortCommander(nemesis)} had beaten you ${nemesisCount}×` })
      }

      // Color pioneer — first win in a brand-new color identity.
      const identity = colorsOf(me)
      const ck = colorIdentityKey(identity)
      if (!wonColorIdentities.has(ck)) {
        wonColorIdentities.add(ck)
        milestones.push({ kind: "color-pioneer", label: `First win in ${colorIdentityLabel(identity)}`, detail: "New colors on the board" })
      }

      if (me && me.seatPosition >= 3) {
        milestones.push({ kind: "tough-seat", label: `Won from seat ${me.seatPosition}`, detail: "Back-of-the-table win" })
      }
      const beatFastMana =
        !me?.fastMana?.hasFastMana &&
        game.players.some((p) => !p.isMe && p.fastMana?.hasFastMana)
      if (beatFastMana) {
        milestones.push({ kind: "underdog", label: "Beat a fast-mana start", detail: "No fast mana of your own" })
      }
      if (game.winTurn && game.winTurn <= 5) {
        milestones.push({ kind: "fast-win", label: `Turn-${game.winTurn} kill`, detail: cmdr })
      }
      if (game.winTurn && game.winTurn >= 12) {
        milestones.push({ kind: "slow-burn", label: `Turn-${game.winTurn} grind`, detail: cmdr })
      }
      // Bracket buster — win meaningfully above your usual power level.
      if (game.bracket && priorBracketAvg !== null && bracketCount >= 3 && game.bracket > priorBracketAvg + 0.75) {
        milestones.push({ kind: "bracket-buster", label: "Bracket buster", detail: `Won up at bracket ${game.bracket}` })
      }
      if (game.keyWinconCards && game.keyWinconCards.length > 0) {
        milestones.push({ kind: "wincon", label: `Closed with ${game.keyWinconCards[0]}` })
      }
    } else {
      streak = 0
      lossStreak += 1
      if (lossStreak >= 2) {
        milestones.push({ kind: "loss-streak", label: `${lossStreak}-loss streak` })
      }
      if (typeof me?.knockoutTurn === "number" && me.knockoutTurn <= 6) {
        milestones.push({ kind: "knockout", label: `Knocked out turn ${me.knockoutTurn}`, detail: cmdr })
      }
      const winner = game.players.find((p) => p.id === game.winnerId)
      if (winner && !winner.isMe) {
        beatenByCount.set(winner.commanderName, (beatenByCount.get(winner.commanderName) ?? 0) + 1)
      }
    }

    // Flawless month — closing game of a calendar month that went undefeated (≥3 games).
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    const ma = monthAgg.get(monthKey)
    if (ma && ma.lastId === game.id && ma.count >= 3 && ma.wins === ma.count) {
      milestones.push({ kind: "flawless-month", label: "Flawless month", detail: `${ma.count}–0 in ${ma.label}` })
    }

    if (game.bracket) {
      bracketSum += game.bracket
      bracketCount += 1
    }

    return { game, me, won, date, careerIndex, winNumber, milestones }
  })

  return events.reverse()
}

// ── Month grouping (over already newest-first events) ────────────────────────

export interface MonthChapter {
  key: string
  label: string
  events: TimelineEvent[]
  games: number
  wins: number
  winRate: number
  topCommander?: string
  topCommanderGames: number
}

export function groupByMonth(events: TimelineEvent[]): MonthChapter[] {
  const chapters: MonthChapter[] = []
  let current: MonthChapter | null = null

  for (const ev of events) {
    const d = ev.date
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!current || current.key !== key) {
      current = {
        key,
        label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        events: [],
        games: 0,
        wins: 0,
        winRate: 0,
        topCommanderGames: 0,
      }
      chapters.push(current)
    }
    current.events.push(ev)
  }

  for (const c of chapters) {
    c.games = c.events.length
    c.wins = c.events.filter((e) => e.won).length
    c.winRate = c.games ? c.wins / c.games : 0
    const tally = new Map<string, number>()
    for (const e of c.events) {
      const name = e.me?.commanderName
      if (name) tally.set(name, (tally.get(name) ?? 0) + 1)
    }
    for (const [name, count] of tally) {
      if (count > c.topCommanderGames) {
        c.topCommander = name
        c.topCommanderGames = count
      }
    }
  }

  return chapters
}

// ── Pod grouping ─────────────────────────────────────────────────────────────

export interface PodBlock {
  key: string
  label: string
  events: TimelineEvent[]
  games: number
  wins: number
  latest: number
}

function podKeyForGame(game: Game): string | null {
  const names = game.players.map((p) => p.displayName?.trim()).filter(Boolean) as string[]
  if (names.length !== game.players.length || names.length === 0) return null
  return [...names].sort((a, b) => a.localeCompare(b)).join("|||")
}

/** Group events by the exact set of players at the table (a "pod"). Games where
 *  not every seat is named are dropped, matching the existing History pods view. */
export function groupIntoPods(events: TimelineEvent[]): PodBlock[] {
  const map = new Map<string, PodBlock>()
  for (const ev of events) {
    const key = podKeyForGame(ev.game)
    if (!key) continue
    let block = map.get(key)
    if (!block) {
      const names = [...new Set(ev.game.players.map((p) => p.displayName!.trim()))].sort((a, b) =>
        a.localeCompare(b)
      )
      block = { key, label: names.join(", "), events: [], games: 0, wins: 0, latest: 0 }
      map.set(key, block)
    }
    block.events.push(ev)
    block.games += 1
    if (ev.won) block.wins += 1
    block.latest = Math.max(block.latest, ev.date.getTime())
  }
  return Array.from(map.values()).sort((a, b) => b.latest - a.latest)
}

// ── Formatting helpers ───────────────────────────────────────────────────────

export function colorsOf(me?: Player): MtgColor[] {
  return (me?.commanderColorIdentity ?? []) as MtgColor[]
}

export function opponentsOf(game: Game): string[] {
  return game.players
    .filter((p) => !p.isMe)
    .map((p) => p.commanderName.split(" // ")[0].split(",")[0])
}

export function shortCommander(name?: string): string {
  if (!name) return "Unknown"
  return name.split(" // ")[0]
}

export function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}
