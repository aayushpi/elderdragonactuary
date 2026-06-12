import { useEffect, useMemo, useState } from "react"
import { Plus, ArrowUpDown } from "lucide-react"
import { EloCard } from "@/components/EloCard"
import { CommanderStatCard } from "@/components/CommanderStatCard"
import { BracketPie } from "@/components/stats/BracketPie"
import { ManaCost } from "@/components/ManaCost"
import { computeStats, computePodElo, computeCommanderElo } from "@/lib/stats"
import { CARD, SECTION_LABEL, WrBar } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { CommanderStat, Game, WinRateStat } from "@/types"

interface StatsPageProps {
  games: Game[]
  onNavigate: (path: string) => void
  onOpenLogGame: (commanderName?: string) => void
}

const RANGES = ["All time", "This year", "Last 90 days"] as const
type Range = (typeof RANGES)[number]

const STAT_LABEL = "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
const SEAT_ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th" }

type CommanderSort = "win-rate" | "win-turn" | "total-wins"
type SortDirection = "asc" | "desc"

function inRange(playedAt: string, range: Range): boolean {
  if (range === "All time") return true
  const d = new Date(playedAt)
  const now = new Date()
  if (range === "This year") return d.getFullYear() === now.getFullYear()
  return now.getTime() - d.getTime() <= 90 * 24 * 60 * 60 * 1000
}

function fmtRate(stat: WinRateStat): { val: string; sub: string } {
  if (stat.games === 0) return { val: "—", sub: "no games" }
  return { val: `${Math.round(stat.rate * 100)}%`, sub: `${stat.wins} wins / ${stat.games} games` }
}

function colorIdentityToManaCost(colors: string[]): string {
  if (colors.length === 0) return "{C}"
  return colors.map((c) => `{${c}}`).join("")
}

function sortCommanders(
  commanders: CommanderStat[],
  sort: CommanderSort,
  direction: SortDirection
): CommanderStat[] {
  return [...commanders].sort((a, b) => {
    let comparison = 0
    if (sort === "win-turn") {
      if (a.averageWinTurn === null && b.averageWinTurn === null) comparison = 0
      else if (a.averageWinTurn === null) comparison = 1
      else if (b.averageWinTurn === null) comparison = -1
      else comparison = a.averageWinTurn - b.averageWinTurn
    } else if (sort === "total-wins") {
      comparison = a.wins - b.wins || a.games - b.games
    } else {
      comparison = a.rate - b.rate || a.games - b.games
    }
    return direction === "asc" ? comparison : -comparison
  })
}

/** Leading streak from "me"'s most-recent results, plus the last 10 W/L. */
function recentForm(games: Game[]): { count: number; type: "win" | "loss" | null; recent: { id: string; win: boolean }[] } {
  const recent = games
    .slice(0, 10)
    .map((g) => {
      const me = g.players.find((p) => p.isMe)
      if (!me) return null
      return { id: g.id, win: g.winnerId === me.id }
    })
    .filter((r): r is { id: string; win: boolean } => r !== null)

  let count = 0
  let type: "win" | "loss" | null = null
  for (const r of recent) {
    if (type === null) {
      type = r.win ? "win" : "loss"
      count = 1
    } else if ((r.win && type === "win") || (!r.win && type === "loss")) {
      count++
    } else break
  }
  return { count, type, recent }
}

function monthlyTrend(games: Game[]): { label: string; games: number; wins: number }[] {
  const buckets = new Map<string, { games: number; wins: number }>()
  for (const g of games) {
    const me = g.players.find((p) => p.isMe)
    if (!me) continue
    const d = new Date(g.playedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const b = buckets.get(key) ?? { games: 0, wins: 0 }
    b.games += 1
    if (g.winnerId === me.id) b.wins += 1
    buckets.set(key, b)
  }
  const out: { label: string; games: number; wins: number }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const b = buckets.get(key) ?? { games: 0, wins: 0 }
    out.push({ label: d.toLocaleDateString(undefined, { month: "short" }), ...b })
  }
  return out
}

function podSizeBreakdown(games: Game[]): { label: string; rate: number; games: number }[] {
  const buckets = new Map<number, { wins: number; games: number }>()
  for (const g of games) {
    const me = g.players.find((p) => p.isMe)
    if (!me) continue
    const size = g.players.length
    const b = buckets.get(size) ?? { wins: 0, games: 0 }
    b.games += 1
    if (g.winnerId === me.id) b.wins += 1
    buckets.set(size, b)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, b]) => ({ label: `${size} players`, rate: b.games ? b.wins / b.games : 0, games: b.games }))
}

function RangeChips({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            "h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
            value === r
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={CARD + " p-4 sm:p-5"}>
      <div className={STAT_LABEL}>{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-none tracking-tight tabular">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function WinStreakCard({ games }: { games: Game[] }) {
  const { count, type, recent } = recentForm(games)
  if (recent.length === 0) return null
  return (
    <div className={CARD + " p-4 sm:p-5"}>
      <div className={STAT_LABEL}>
        {count} {type === "loss" ? "loss" : "win"} streak
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {recent.map((r) => (
          <span
            key={r.id}
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ring-1",
              r.win
                ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/40 dark:text-emerald-400"
                : "bg-rose-500/15 text-rose-600 ring-rose-500/40 dark:text-rose-400"
            )}
          >
            {r.win ? "W" : "L"}
          </span>
        ))}
      </div>
    </div>
  )
}

function TopWaysCard({ conditions }: { conditions: { condition: string; count: number }[] }) {
  return (
    <div className={CARD + " p-4 sm:p-5"}>
      <div className={STAT_LABEL}>Top ways to win</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {conditions.map((wc) => (
          <span
            key={wc.condition}
            className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
          >
            {wc.condition}
            <span className="ml-1 text-muted-foreground">× {wc.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function StartingTurnCard({ rows }: { rows: { seat: number; stat: WinRateStat }[] }) {
  return (
    <div className="space-y-3">
      <div className={SECTION_LABEL}>Win rate by starting turn</div>
      <div className={CARD + " p-4 sm:p-5 space-y-4"}>
        {rows.map(({ seat, stat }) => (
          <div key={seat}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{SEAT_ORDINALS[seat]} to play</span>
              <span className="font-mono text-xs text-muted-foreground tabular">
                {Math.round(stat.rate * 100)}% ({stat.wins}/{stat.games})
              </span>
            </div>
            <div className="mt-2">
              <WrBar rate={stat.rate} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ColorBox({
  label,
  colors,
  value,
  sub,
}: {
  label: string
  colors: string[] | null
  value: string
  sub?: string
}) {
  return (
    <div className={CARD + " p-4 sm:p-5"}>
      <div className={STAT_LABEL}>{label}</div>
      {colors ? (
        <>
          <div className="mt-2.5">
            <ManaCost cost={colorIdentityToManaCost(colors)} size="sm" />
          </div>
          <div className="mt-2 text-[22px] font-bold leading-none tabular">{value}</div>
          {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
        </>
      ) : (
        <div className="mt-2 text-[22px] font-bold leading-none">—</div>
      )}
    </div>
  )
}

function TrendChart({ data }: { data: { label: string; games: number; wins: number }[] }) {
  const MAX = 0.7
  return (
    <div className={CARD + " p-4 sm:p-5"}>
      <div className="flex items-center justify-between gap-3">
        <div className={SECTION_LABEL}>Win rate by month</div>
        <div className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">— — 25% baseline</div>
      </div>
      <div className="relative mt-5 h-40">
        <div
          className="absolute inset-x-0 border-t border-dashed border-border"
          style={{ bottom: `${(0.25 / MAX) * 100}%` }}
        />
        <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
          {data.map((m, i) => {
            const wr = m.games ? m.wins / m.games : 0
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                title={`${m.label}: ${m.wins} wins / ${m.games} games`}
              >
                <div
                  className="w-full rounded-t-sm bg-primary/80 hover:bg-primary transition-colors"
                  style={{ height: `${Math.min(100, (wr / MAX) * 100)}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {data.map((m, i) => (
          <div
            key={i}
            className="flex-1 text-center font-mono text-[9px] sm:text-[10px] uppercase text-muted-foreground"
          >
            {m.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string
  rows: { label: string; rate: number; games: number }[]
}) {
  return (
    <div className={CARD + " p-4 sm:p-5"}>
      <div className={SECTION_LABEL}>{title}</div>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <div className="w-20 shrink-0 text-xs text-muted-foreground">{r.label}</div>
              <div className="flex-1">
                <WrBar rate={r.rate} />
              </div>
              <div className="w-10 shrink-0 text-right font-mono text-xs font-medium tabular">
                {Math.round(r.rate * 100)}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function StatsPage({ games, onOpenLogGame }: StatsPageProps) {
  const [range, setRange] = useState<Range>("All time")
  const [commanderSort, setCommanderSort] = useState<CommanderSort>("win-rate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const filtered = useMemo(() => games.filter((g) => inRange(g.playedAt, range)), [games, range])
  const stats = useMemo(() => computeStats(filtered), [filtered])
  const trend = useMemo(() => monthlyTrend(filtered), [filtered])
  const podSizes = useMemo(() => podSizeBreakdown(filtered), [filtered])
  const podEloGroups = useMemo(() => computePodElo(games), [games])
  const commanderElo = useMemo(() => computeCommanderElo(games), [games])

  useEffect(() => {
    import("@/lib/analytics").then((mod) => {
      try {
        mod.trackViewStats({ stats_view: "overall", games_played: stats.gamesPlayed })
      } catch {
        void 0
      }
    })
  }, [stats.gamesPlayed])

  const seatRows = useMemo(() => {
    const entries: [number, WinRateStat][] = [
      [1, stats.bySeat.seat1],
      [2, stats.bySeat.seat2],
      [3, stats.bySeat.seat3],
      [4, stats.bySeat.seat4],
      [5, stats.bySeat.seat5],
      [6, stats.bySeat.seat6],
    ]
    return entries.filter(([, s]) => s.games > 0).map(([seat, stat]) => ({ seat, stat }))
  }, [stats.bySeat])

  const sortedCommanders = useMemo(
    () => sortCommanders(stats.byCommander, commanderSort, sortDirection),
    [stats.byCommander, commanderSort, sortDirection]
  )

  const hasBracketData = stats.byBracket.some((b) => b.games > 0)
  const hasColorData =
    stats.mostPlayedCommanderColorIdentity ||
    stats.mostSuccessfulCommanderColorIdentity ||
    stats.archnemesisCommanderColorIdentity

  if (games.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
        <div className={CARD + " p-12 text-center"}>
          <p className="text-sm font-medium">No games logged yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Log a game to see your stats here.</p>
          <button
            onClick={() => onOpenLogGame()}
            className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-6 text-[15px] rounded-md font-medium bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Track a game
          </button>
        </div>
      </div>
    )
  }

  const avgTurn = stats.averageWinTurn !== null ? stats.averageWinTurn.toFixed(1) : "—"
  const overall = fmtRate(stats.overall)
  const withFm = fmtRate(stats.withFastMana)
  const vsFm = fmtRate(stats.againstFastMana)

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
        <RangeChips value={range} onChange={setRange} />
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatBox label="Win rate" value={overall.val} sub={overall.sub} />
        <StatBox label="Avg win turn" value={avgTurn} sub="when you win" />
        <StatBox label="With fast mana" value={withFm.val} sub={withFm.sub} />
        <StatBox label="Vs fast mana" value={vsFm.val} sub={vsFm.sub} />
      </div>

      {/* Streak + ways to win */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <WinStreakCard games={filtered} />
        {stats.topWinConditions.length > 0 && <TopWaysCard conditions={stats.topWinConditions} />}
      </div>

      {seatRows.length > 0 && <StartingTurnCard rows={seatRows} />}

      {hasBracketData && <BracketPie byBracket={stats.byBracket} />}

      {/* Commander colors */}
      {hasColorData && (
        <div className="space-y-3">
          <div className={SECTION_LABEL}>Commander colors</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <ColorBox
              label="Most played"
              colors={stats.mostPlayedCommanderColorIdentity?.colors ?? null}
              value={
                stats.mostPlayedCommanderColorIdentity
                  ? `${stats.mostPlayedCommanderColorIdentity.games} game${stats.mostPlayedCommanderColorIdentity.games !== 1 ? "s" : ""}`
                  : "—"
              }
            />
            <ColorBox
              label="Most successful"
              colors={stats.mostSuccessfulCommanderColorIdentity?.colors ?? null}
              value={
                stats.mostSuccessfulCommanderColorIdentity
                  ? `${Math.round(stats.mostSuccessfulCommanderColorIdentity.winRate * 100)}%`
                  : "—"
              }
              sub={
                stats.mostSuccessfulCommanderColorIdentity
                  ? `${stats.mostSuccessfulCommanderColorIdentity.wins} wins / ${stats.mostSuccessfulCommanderColorIdentity.games} games`
                  : undefined
              }
            />
            <ColorBox
              label="Archnemesis colors"
              colors={stats.archnemesisCommanderColorIdentity?.colors ?? null}
              value={
                stats.archnemesisCommanderColorIdentity
                  ? `${Math.round(stats.archnemesisCommanderColorIdentity.lossRate * 100)}%`
                  : "—"
              }
              sub={
                stats.archnemesisCommanderColorIdentity
                  ? `${stats.archnemesisCommanderColorIdentity.games - stats.archnemesisCommanderColorIdentity.wins} losses / ${stats.archnemesisCommanderColorIdentity.games} games`
                  : undefined
              }
            />
          </div>
        </div>
      )}

      <TrendChart data={trend} />

      <BreakdownCard title="By pod size" rows={podSizes} />

      {/* Commander performance */}
      {stats.byCommander.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={SECTION_LABEL}>Commander performance</div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Sort by</span>
              <select
                value={commanderSort}
                onChange={(e) => setCommanderSort(e.target.value as CommanderSort)}
                className="h-8 cursor-pointer rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="win-rate">Win rate</option>
                <option value="win-turn">Winning turn</option>
                <option value="total-wins">Total wins</option>
              </select>
              <button
                onClick={() => setSortDirection((p) => (p === "asc" ? "desc" : "asc"))}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2 text-xs hover:bg-muted transition-colors"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortDirection === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {sortedCommanders.map((c, i) => (
              <CommanderStatCard key={c.name} stat={c} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* ELO — computed across all games, regardless of range */}
      {(podEloGroups.length > 0 || commanderElo.length > 0) && (
        <div className="space-y-3">
          <h2 className={SECTION_LABEL}>ELO ratings</h2>
          <EloCard podEloGroups={podEloGroups} commanders={commanderElo} />
        </div>
      )}
    </div>
  )
}
