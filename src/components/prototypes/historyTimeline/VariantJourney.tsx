import { Fragment, useMemo, useState } from "react"
import { Check, Pencil, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"
import { CommanderAvatar } from "./CommanderAvatar"
import { MilestoneEvent } from "./MilestoneBadge"
import {
  buildTimeline,
  dayLabel,
  groupIntoPods,
  opponentsOf,
  shortCommander,
  type TimelineEvent,
} from "./timeline"

type ResultFilter = "All" | "Wins" | "Losses"
type ViewMode = "date" | "pod"

interface JourneyHandlers {
  onEditGame?: (id: string) => void
  onDeleteGame?: (id: string) => void
}

interface MonthBlock {
  key: string
  month: string
  year: number
  showYear: boolean
  events: TimelineEvent[]
}

function groupIntoMonths(events: TimelineEvent[]): MonthBlock[] {
  const blocks: MonthBlock[] = []
  for (const ev of events) {
    const key = `${ev.date.getFullYear()}-${ev.date.getMonth()}`
    let block = blocks[blocks.length - 1]
    if (!block || block.key !== key) {
      block = {
        key,
        month: ev.date.toLocaleDateString(undefined, { month: "long" }),
        year: ev.date.getFullYear(),
        showYear: false,
        events: [],
      }
      blocks.push(block)
    }
    block.events.push(ev)
  }
  let prevYear: number | null = null
  for (const block of blocks) {
    block.showYear = block.year !== prevYear
    prevYear = block.year
  }
  return blocks
}

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

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string
  options: { id: string; label: string }[]
  onChange: (id: string) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-input p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-9 px-4 rounded-[8px] text-sm font-medium transition-colors",
            value === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        danger ? "hover:text-destructive" : "hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function YearDivider({ year }: { year: number }) {
  return (
    <li className="relative pl-12 pb-3 pt-1">
      <span className="absolute left-4 top-2.5 z-40 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-foreground ring-4 ring-background" />
      <div className="font-mono text-base font-semibold uppercase tracking-[0.2em]">{year}</div>
    </li>
  )
}

function MonthHeader({ label, count }: { label: string; count: number }) {
  return (
    <li className="sticky top-0 z-20 -mx-1 bg-background/90 px-1 py-2 backdrop-blur">
      <div className="flex items-baseline justify-between pl-12">
        <span className="text-lg font-semibold tracking-tight">{label}</span>
        <span className="font-mono text-sm text-muted-foreground tabular">
          {count} {count === 1 ? "game" : "games"}
        </span>
      </div>
    </li>
  )
}

function Node({ event, handlers }: { event: TimelineEvent; handlers: JourneyHandlers }) {
  const { game, me, won, date, milestones } = event
  const opponents = opponentsOf(game)
  const highlight = milestones.length > 0

  return (
    <li className="relative pl-12 pb-8 last:pb-0">
      <span
        title={won ? "Win" : "Loss"}
        className={cn(
          "absolute left-4 top-0.5 z-40 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full ring-4 ring-background",
          won ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {won ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </span>
      <div className="flex items-start gap-3">
        <CommanderAvatar name={me?.commanderName} imageUri={me?.commanderImageUri} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-lg font-semibold">{shortCommander(me?.commanderName)}</span>
            {highlight && <span className="h-2 w-2 rounded-full bg-amber-500" title="Has highlights" />}
          </div>
          <div className="mt-1 text-base text-muted-foreground">
            {opponents.length > 0 ? `vs ${opponents.join(" · ")}` : "Solo log"}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-muted-foreground tabular">
            <span>{dayLabel(date)}</span>
            {game.winTurn ? <span>{game.winTurn} turns</span> : null}
            {game.bracket ? <span>bracket {game.bracket}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {handlers.onEditGame && (
            <IconButton label="Edit game" onClick={() => handlers.onEditGame!(game.id)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          )}
          {handlers.onDeleteGame && (
            <IconButton
              label="Delete game"
              danger
              onClick={() => {
                if (window.confirm("Delete this game?")) handlers.onDeleteGame!(game.id)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>

      {highlight && (
        <div className="ml-12 mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          {milestones.map((m, i) => (
            <MilestoneEvent key={i} milestone={m} />
          ))}
        </div>
      )}
    </li>
  )
}

function Spine({ events, handlers }: { events: TimelineEvent[]; handlers: JourneyHandlers }) {
  return (
    <ol className="relative">
      <span className="pointer-events-none absolute left-4 top-2 bottom-2 z-30 w-px -translate-x-1/2 bg-border" />
      {events.map((ev) => (
        <Node key={ev.game.id} event={ev} handlers={handlers} />
      ))}
    </ol>
  )
}

export function VariantJourney({ games, onEditGame, onDeleteGame }: { games: Game[] } & JourneyHandlers) {
  const allEvents = useMemo(() => buildTimeline(games), [games])

  const heroes = useMemo(() => {
    const names = new Set<string>()
    for (const ev of allEvents) {
      if (ev.me?.commanderName) names.add(ev.me.commanderName)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [allEvents])

  const [viewMode, setViewMode] = useState<ViewMode>("date")
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

  const months = useMemo(() => groupIntoMonths(shown), [shown])
  const pods = useMemo(() => groupIntoPods(shown), [shown])
  const handlers: JourneyHandlers = { onEditGame, onDeleteGame }

  if (allEvents.length === 0) {
    return <p className="text-base text-muted-foreground">No games yet.</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { id: "date", label: "By date" },
            { id: "pod", label: "By pod" },
          ]}
        />
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

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {(["All", "Wins", "Losses"] as ResultFilter[]).map((f) => (
          <Chip key={f} active={result === f} onClick={() => setResult(f)}>
            {f}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <div className="text-base font-medium">No games match</div>
          <div className="mt-1 text-sm text-muted-foreground">Try a different filter.</div>
        </div>
      ) : viewMode === "pod" ? (
        pods.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-12 text-center">
            <div className="text-base font-medium">No pods to show</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Pods form once every seat in a game is named.
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {pods.map((pod) => (
              <section key={pod.key}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className="truncate text-lg font-semibold tracking-tight">{pod.label}</h3>
                  <span className="shrink-0 font-mono text-sm text-muted-foreground tabular">
                    {pod.wins}–{pod.games - pod.wins}
                  </span>
                </div>
                <Spine events={pod.events} handlers={handlers} />
              </section>
            ))}
          </div>
        )
      ) : (
        <>
          <ol className="relative">
            <span className="pointer-events-none absolute left-4 top-2 bottom-2 z-30 w-px -translate-x-1/2 bg-border" />
            {months.map((block) => (
              <Fragment key={block.key}>
                {block.showYear && <YearDivider year={block.year} />}
                <MonthHeader label={block.month} count={block.events.length} />
                {block.events.map((ev) => (
                  <Node key={ev.game.id} event={ev} handlers={handlers} />
                ))}
              </Fragment>
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
