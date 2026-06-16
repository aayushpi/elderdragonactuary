import { useMemo } from "react"
import { CARD, SECTION_LABEL } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"
import { MilestoneBadge } from "./MilestoneBadge"
import { buildTimeline, opponentsOf, shortCommander, type TimelineEvent } from "./timeline"

// ── Contribution heatmap ─────────────────────────────────────────────────────

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function Heatmap({ events }: { events: TimelineEvent[] }) {
  const { weeks, monthMarks, max } = useMemo(() => {
    const counts = new Map<string, number>()
    let max = 0
    for (const ev of events) {
      const k = dayKey(ev.date)
      const n = (counts.get(k) ?? 0) + 1
      counts.set(k, n)
      if (n > max) max = n
    }

    const dates = events.map((e) => startOfDay(e.date).getTime())
    const last = dates.length ? new Date(Math.max(...dates)) : new Date()
    const earliest = dates.length ? new Date(Math.min(...dates)) : new Date()

    // start at the Sunday on/before the earliest game (cap at ~20 weeks)
    const start = startOfDay(earliest)
    start.setDate(start.getDate() - start.getDay())
    const end = startOfDay(last)
    end.setDate(end.getDate() + (6 - end.getDay()))
    const cap = new Date(end)
    cap.setDate(cap.getDate() - 20 * 7)
    if (start < cap) start.setTime(cap.getTime())

    const weeks: { date: Date; count: number }[][] = []
    const monthMarks: { col: number; label: string }[] = []
    const cursor = new Date(start)
    let col = 0
    let lastMonth = -1
    while (cursor <= end) {
      const week: { date: Date; count: number }[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor)
        week.push({ date: d, count: counts.get(dayKey(d)) ?? 0 })
        if (i === 0 && d.getMonth() !== lastMonth) {
          lastMonth = d.getMonth()
          monthMarks.push({ col, label: d.toLocaleDateString(undefined, { month: "short" }) })
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
      col++
    }
    return { weeks, monthMarks, max }
  }, [events])

  function intensity(count: number): string {
    if (count <= 0) return "bg-muted/50"
    const ratio = max <= 1 ? 1 : count / max
    if (ratio > 0.66) return "bg-primary"
    if (ratio > 0.33) return "bg-primary/60"
    return "bg-primary/30"
  }

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="inline-block min-w-full">
        <div className="flex gap-[3px] pl-7">
          {weeks.map((_, col) => {
            const mark = monthMarks.find((m) => m.col === col)
            return (
              <div key={col} className="w-[12px] text-[9px] text-muted-foreground">
                {mark?.label ?? ""}
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-[3px]">
          <div className="mr-1 flex flex-col justify-between py-[1px] text-[9px] text-muted-foreground">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          {weeks.map((week, col) => (
            <div key={col} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.date.toISOString()}
                  title={`${cell.date.toLocaleDateString()} — ${cell.count} game${cell.count === 1 ? "" : "s"}`}
                  className={cn("h-[12px] w-[12px] rounded-[2px]", intensity(cell.count))}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Feed ─────────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const day = 1000 * 60 * 60 * 24
  const days = Math.floor(diff / day)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function FeedLine({ event }: { event: TimelineEvent }) {
  const { me, won, date, game, milestones } = event
  const cmdr = shortCommander(me?.commanderName)
  const opponents = opponentsOf(game)

  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          won ? "bg-primary" : "bg-muted-foreground/40"
        )}
      />
      <div className="min-w-0 flex-1 pb-4">
        <p className="text-sm">
          <span className="font-semibold">{won ? "Won" : "Lost"}</span> with{" "}
          <span className="font-medium">{cmdr}</span>
          {won && game.winTurn ? ` on turn ${game.winTurn}` : ""}
          {opponents.length > 0 ? (
            <span className="text-muted-foreground"> vs {opponents.join(" · ")}</span>
          ) : null}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground tabular">
            {relativeTime(date)}
          </span>
          {milestones.map((m, i) => (
            <MilestoneBadge key={i} milestone={m} />
          ))}
        </div>
      </div>
    </li>
  )
}

/**
 * Variant C — "Activity".
 * A social-style feed of your play, fronted by a GitHub-style contribution
 * heatmap so you can feel the rhythm of how often you get to the table.
 */
export function VariantFeed({ games }: { games: Game[] }) {
  const events = buildTimeline(games)

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No games yet.</p>
  }

  return (
    <div className="space-y-6">
      <div className={CARD + " p-4 sm:p-5"}>
        <h2 className={SECTION_LABEL + " mb-3"}>Table time</h2>
        <Heatmap events={events} />
      </div>

      <div>
        <h2 className={SECTION_LABEL + " mb-3"}>Recent activity</h2>
        <ul className="relative">
          <span className="absolute left-[3px] top-2 bottom-2 w-px bg-border" />
          {events.map((ev) => (
            <FeedLine key={ev.game.id} event={ev} />
          ))}
        </ul>
      </div>
    </div>
  )
}
