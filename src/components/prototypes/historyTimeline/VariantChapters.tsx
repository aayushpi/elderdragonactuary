import { CARD, Pips, ResultBadge, WrBar } from "@/components/modern/primitives"
import type { Game } from "@/types"
import { MilestoneBadge } from "./MilestoneBadge"
import {
  buildTimeline,
  colorsOf,
  dayLabel,
  groupByMonth,
  opponentsOf,
  shortCommander,
} from "./timeline"

/**
 * Variant B — "Chapters".
 * Your career told month by month. Each month is a chapter with a narrative
 * header (record, win rate, signature deck), then the games of that month as a
 * compact run. Milestones surface as inline highlight strips between games.
 */
export function VariantChapters({ games }: { games: Game[] }) {
  const events = buildTimeline(games)
  const chapters = groupByMonth(events)

  if (chapters.length === 0) {
    return <p className="text-sm text-muted-foreground">No games yet.</p>
  }

  return (
    <div className="space-y-8">
      {chapters.map((chapter) => (
        <section key={chapter.key}>
          <div className={CARD + " p-4 sm:p-5"}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">{chapter.label}</h2>
              <span className="font-mono text-[11px] text-muted-foreground tabular">
                {chapter.wins}–{chapter.games - chapter.wins}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {chapter.games} {chapter.games === 1 ? "game" : "games"}
              {chapter.topCommander ? ` · mostly ${shortCommander(chapter.topCommander)}` : ""}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <WrBar rate={chapter.winRate} />
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular">
                {Math.round(chapter.winRate * 100)}%
              </span>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {chapter.events.map((ev) => {
              const colors = colorsOf(ev.me)
              const opponents = opponentsOf(ev.game)
              return (
                <li key={ev.game.id}>
                  {ev.milestones.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5 pl-1">
                      {ev.milestones.map((m, i) => (
                        <MilestoneBadge key={i} milestone={m} />
                      ))}
                    </div>
                  )}
                  <div className={CARD + " flex items-center gap-3 px-4 py-3"}>
                    <ResultBadge won={ev.won} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {shortCommander(ev.me?.commanderName)}
                        </span>
                        {colors.length > 0 && (
                          <span className="hidden sm:inline-flex">
                            <Pips colors={colors} />
                          </span>
                        )}
                      </div>
                      {opponents.length > 0 && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          vs {opponents.join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular leading-5">
                      <div>{dayLabel(ev.date)}</div>
                      {ev.game.winTurn ? <div>{ev.game.winTurn} turns</div> : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
