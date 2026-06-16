import type { Game, MtgColor, Player } from "@/types"

// ── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneKind =
  | "first-game"
  | "milestone-game"
  | "debut"
  | "first-win"
  | "win"
  | "streak"
  | "fast-win"
  | "wincon"
  | "knockout"

export interface Milestone {
  kind: MilestoneKind
  /** Headline, e.g. "5th career win". */
  label: string
  /** Supporting context, e.g. "Krenko, Mob Boss". */
  detail?: string
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

  const seenCommanders = new Set<string>()
  let winCount = 0
  let streak = 0

  const events: TimelineEvent[] = chrono.map((game, i) => {
    const me = game.players.find((p) => p.isMe)
    const won = !!me && game.winnerId === me.id
    const careerIndex = i + 1
    const cmdr = shortCommander(me?.commanderName)
    const milestones: Milestone[] = []

    if (careerIndex === 1) {
      milestones.push({ kind: "first-game", label: "First game logged", detail: cmdr })
    } else if (GAME_LANDMARKS.has(careerIndex)) {
      milestones.push({ kind: "milestone-game", label: `${ordinal(careerIndex)} game played`, detail: cmdr })
    }

    if (me?.commanderName && !seenCommanders.has(me.commanderName)) {
      if (seenCommanders.size > 0) {
        milestones.push({ kind: "debut", label: `${cmdr} debut`, detail: "First time piloting this deck" })
      }
      seenCommanders.add(me.commanderName)
    }

    let winNumber: number | null = null
    if (won) {
      winCount += 1
      winNumber = winCount
      streak += 1

      if (winCount === 1) {
        milestones.push({ kind: "first-win", label: "First win", detail: cmdr })
      } else if (WIN_LANDMARKS.has(winCount)) {
        milestones.push({ kind: "win", label: `${ordinal(winCount)} career win`, detail: cmdr })
      }

      if (streak >= 2) {
        milestones.push({ kind: "streak", label: `${streak}-win streak` })
      }
      if (game.winTurn && game.winTurn <= 5) {
        milestones.push({ kind: "fast-win", label: `Turn-${game.winTurn} kill`, detail: cmdr })
      }
      if (game.keyWinconCards && game.keyWinconCards.length > 0) {
        milestones.push({ kind: "wincon", label: `Closed with ${game.keyWinconCards[0]}` })
      }
    } else {
      streak = 0
      if (typeof me?.knockoutTurn === "number" && me.knockoutTurn <= 6) {
        milestones.push({ kind: "knockout", label: `Knocked out turn ${me.knockoutTurn}`, detail: cmdr })
      }
    }

    return { game, me, won, date: new Date(game.playedAt), careerIndex, winNumber, milestones }
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
