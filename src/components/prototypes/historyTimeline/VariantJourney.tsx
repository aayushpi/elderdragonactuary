import { Pips, ResultBadge } from "@/components/modern/primitives"
import type { Game } from "@/types"
import { MilestoneBadge } from "./MilestoneBadge"
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
 * A single vertical spine running top-to-bottom. Every game is a node; wins
 * light the node up, milestones bloom as chips beside it. Reads like a metro
 * line of your Commander career, newest at the top.
 */
function Node({ event }: { event: TimelineEvent }) {
  const { game, me, won, date, careerIndex, milestones } = event
  const colors = colorsOf(me)
  const opponents = opponentsOf(game)

  return (
    <li className="relative pl-10 pb-7 last:pb-0">
      {/* spine dot */}
      <span
        className={
          "absolute left-[14px] top-1.5 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-4 ring-background " +
          (won ? "bg-primary" : "bg-muted-foreground/40")
        }
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ResultBadge won={won} />
        <span className="text-sm font-semibold">{shortCommander(me?.commanderName)}</span>
        {colors.length > 0 && (
          <span className="inline-flex">
            <Pips colors={colors} />
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular">
          #{careerIndex}
        </span>
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        {opponents.length > 0 ? `vs ${opponents.join(" · ")}` : "Solo log"}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground tabular">{dayLabel(date)}</span>
        {game.winTurn ? (
          <span className="font-mono text-[11px] text-muted-foreground tabular">
            · {game.winTurn} turns
          </span>
        ) : null}
      </div>

      {milestones.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {milestones.map((m, i) => (
            <MilestoneBadge key={i} milestone={m} />
          ))}
        </div>
      )}
    </li>
  )
}

export function VariantJourney({ games }: { games: Game[] }) {
  const events = buildTimeline(games)

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No games yet.</p>
  }

  return (
    <ol className="relative">
      {/* the spine */}
      <span className="absolute left-[14px] top-2 bottom-2 w-px -translate-x-1/2 bg-border" />
      {events.map((ev) => (
        <Node key={ev.game.id} event={ev} />
      ))}
    </ol>
  )
}
