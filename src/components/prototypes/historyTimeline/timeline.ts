import type { Game, MtgColor, Player } from "@/types"

// ── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneKind =
  | "first-game"
  | "first-win"
  | "milestone-game"
  | "streak"
  | "debut"
  | "fast-win"

export interface Milestone {
  kind: MilestoneKind
  label: string
}

export interface TimelineEvent {
  game: Game
  me?: Player
  won: boolean
  date: Date
  /** 1-based index of this game in the user's career (chronological). */
  careerIndex: number
  milestones: Milestone[]
}

const GAME_COUNT_MILESTONES = new Set([1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 500])

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Walk games chronologically to derive career milestones (streaks, debuts,
 * firsts), then return events newest-first for display.
 */
export function buildTimeline(games: Game[]): TimelineEvent[] {
  const chrono = [...games].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  )

  const seenCommanders = new Set<string>()
  let hasWon = false
  let streak = 0

  const events: TimelineEvent[] = chrono.map((game, i) => {
    const me = game.players.find((p) => p.isMe)
    const won = !!me && game.winnerId === me.id
    const careerIndex = i + 1
    const milestones: Milestone[] = []

    if (careerIndex === 1) {
      milestones.push({ kind: "first-game", label: "First game logged" })
    }
    if (GAME_COUNT_MILESTONES.has(careerIndex) && careerIndex !== 1) {
      milestones.push({ kind: "milestone-game", label: `${ordinal(careerIndex)} game` })
    }

    const cmdr = me?.commanderName
    if (cmdr && !seenCommanders.has(cmdr)) {
      if (seenCommanders.size > 0) {
        milestones.push({ kind: "debut", label: `Debut: ${cmdr.split(",")[0]}` })
      }
      seenCommanders.add(cmdr)
    }

    if (won) {
      if (!hasWon) {
        hasWon = true
        milestones.push({ kind: "first-win", label: "First win" })
      }
      streak += 1
      if (streak >= 2) {
        milestones.push({ kind: "streak", label: `${streak}-game win streak` })
      }
      if (game.winTurn && game.winTurn <= 5) {
        milestones.push({ kind: "fast-win", label: `Fast win — turn ${game.winTurn}` })
      }
    } else {
      streak = 0
    }

    return { game, me, won, date: new Date(game.playedAt), careerIndex, milestones }
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
    let best: string | undefined
    let bestCount = 0
    for (const [name, count] of tally) {
      if (count > bestCount) {
        best = name
        bestCount = count
      }
    }
    c.topCommander = best
  }

  return chapters
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
