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

/**
 * Variant A — "The Journey".
 * A vertical spine, newest at the top. Every game is a node; games that hit a
 * milestone bloom into a highlighted card listing each discrete highlight
 * (5th win · Krenko, Closed with Craterhoof Behemoth, …).
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
  const events = buildTimeline(games)

  if (events.length === 0) {
    return <p className="text-base text-muted-foreground">No games yet.</p>
  }

  return (
    <ol className="relative">
      <span className="absolute left-4 top-2 bottom-2 w-px -translate-x-1/2 bg-border" />
      {events.map((ev) => (
        <Node key={ev.game.id} event={ev} />
      ))}
    </ol>
  )
}
