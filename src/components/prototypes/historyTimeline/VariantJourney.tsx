import { useMemo, useState } from "react"
import { Pips, ResultBadge } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"
import { MilestoneEvent } from "./MilestoneBadge"
import {
  buildTimeline,
  colorsOf,
  dayLabel,
  opponentsOf,
  shortCommander,
  type TimelineEvent,
} from "./timeline"

type ResultFilter = "All" | "Wins" | "Losses"

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors",
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}

/**
 * Variant A — "The Journey".
 * A vertical spine, newest at the top. Every game is a node; games that hit a
 * milestone bloom into a highlighted card listing each discrete highlight.
 * Filter by result or hero — milestones keep their career-wide numbering since
 * they're computed over the full timeline before filtering.
 */
function Node({ event }: { event: TimelineEvent }) {
  const { game, me, won, date, careerIndex, milestones } = event
  const colors = colorsOf(me)
  const opponents = opponentsOf(game)
  const highlight = milestones.length > 0

  return (
    <li className="relative pl-12 pb-8 last:pb-0">
      <span
        className={cn(
          "absolute left-4 top-1.5 z-10 -translate-x-1/2 rounded-full ring-4 ring-background",
          highlight ? "h-4 w-4 bg-amber-500" : won ? "h-3.5 w-3.5 bg-primary" : "h-3.5 w-3.5 bg-muted-foreground/40"
        )}
      />
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <ResultBadge won={won} />
        <span className="text-lg font-semibold">{shortCommander(me?.commanderName)}</span>
        {colors.length > 0 && (
          <span className="inline-flex">
            <Pips colors={colors} />
          </span>
        )}
        <span className="ml-auto font-mono text-sm text-muted-foreground tabular">#{careerIndex}</span>
      </div>

      <div className="mt-1 text-base text-muted-foreground">
        {opponents.length > 0 ? `vs ${opponents.join(" · ")}` : "Solo log"}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-muted-foreground tabular">
        <span>{dayLabel(date)}</span>
        {game.winTurn ? <span>{game.winTurn} turns</span> : null}
        {game.bracket ? <span>bracket {game.bracket}</span> : null}
      </div>

      {highlight && (
        <div className="mt-3 space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4">
          {milestones.map((m, i) => (
            <MilestoneEvent key={i} milestone={m} />
          ))}
        </div>
      )}
    </li>
  )
}

export function VariantJourney({ games }: { games: Game[] }) {
  const allEvents = useMemo(() => buildTimeline(games), [games])

  const heroes = useMemo(() => {
    const names = new Set<string>()
    for (const ev of allEvents) {
      if (ev.me?.commanderName) names.add(ev.me.commanderName)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [allEvents])

  const [result, setResult] = useState<ResultFilter>("All")
  const [hero, setHero] = useState("all")

  const shown = useMemo(
    () =>
      allEvents.filter((ev) => {
        if (result === "Wins" && !ev.won) return false
        if (result === "Losses" && ev.won) return false
        if (hero !== "all" && ev.me?.commanderName !== hero) return false
        return true
      }),
    [allEvents, result, hero]
  )

  if (allEvents.length === 0) {
    return <p className="text-base text-muted-foreground">No games yet.</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(["All", "Wins", "Losses"] as ResultFilter[]).map((f) => (
            <Chip key={f} active={result === f} onClick={() => setResult(f)}>
              {f}
            </Chip>
          ))}
        </div>
        <select
          value={hero}
          onChange={(e) => setHero(e.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All heroes</option>
          {heroes.map((name) => (
            <option key={name} value={name}>
              {shortCommander(name)}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <div className="text-base font-medium">No games match</div>
          <div className="mt-1 text-sm text-muted-foreground">Try a different filter.</div>
        </div>
      ) : (
        <>
          <ol className="relative">
            <span className="absolute left-4 top-2 bottom-2 w-px -translate-x-1/2 bg-border" />
            {shown.map((ev) => (
              <Node key={ev.game.id} event={ev} />
            ))}
          </ol>
          <div className="text-center font-mono text-sm text-muted-foreground tabular">
            showing {shown.length} of {allEvents.length} games
          </div>
        </>
      )}
    </div>
  )
}
