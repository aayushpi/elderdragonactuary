import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { EloCard } from "@/components/EloCard"
import { TopWinConditionsCard } from "@/components/TopWinConditionsCard"
import { computeStats, computePodElo, computeCommanderElo } from "@/lib/stats"
import { CARD, SECTION_LABEL, Pips, WrBar } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { Game, MtgColor, WinRateStat } from "@/types"

interface StatsPageProps {
  games: Game[]
  onNavigate: (path: string) => void
  onOpenLogGame: (commanderName?: string) => void
}

const RANGES = ["All time", "This year", "Last 90 days"] as const
type Range = (typeof RANGES)[number]

function inRange(playedAt: string, range: Range): boolean {
  if (range === "All time") return true
  const d = new Date(playedAt)
  const now = new Date()
  if (range === "This year") return d.getFullYear() === now.getFullYear()
  return now.getTime() - d.getTime() <= 90 * 24 * 60 * 60 * 1000
}

function buildColorMap(games: Game[]): Map<string, MtgColor[]> {
  const map = new Map<string, MtgColor[]>()
  for (const g of games) {
    const me = g.players.find((p) => p.isMe)
    if (me?.commanderColorIdentity && !map.has(me.commanderName)) {
      map.set(me.commanderName, me.commanderColorIdentity)
    }
  }
  return map
}

/** Trailing 12 months of [label, games, wins] from "me"'s results. */
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

  const filtered = useMemo(() => games.filter((g) => inRange(g.playedAt, range)), [games, range])
  const stats = useMemo(() => computeStats(filtered), [filtered])
  const colorMap = useMemo(() => buildColorMap(games), [games])
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
    return entries
      .filter(([, s]) => s.games > 0)
      .map(([seat, s]) => ({ label: `Seat ${seat}`, rate: s.rate, games: s.games }))
  }, [stats.bySeat])

  const commanders = useMemo(
    () => [...stats.byCommander].sort((a, b) => b.games - a.games),
    [stats.byCommander]
  )

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

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
        <RangeChips value={range} onChange={setRange} />
      </div>

      <TrendChart data={trend} />

      {/* By commander */}
      <div className={CARD + " overflow-hidden"}>
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className={SECTION_LABEL}>By commander</div>
          <div className="font-mono text-[10px] text-muted-foreground">sorted by games</div>
        </div>
        <div className="divide-y divide-border">
          {commanders.length === 0 ? (
            <div className="px-4 sm:px-5 py-6 text-xs text-muted-foreground">No commander data in range.</div>
          ) : (
            commanders.map((c) => (
              <div key={c.name} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="mt-1">
                    <Pips colors={colorMap.get(c.name) ?? []} />
                  </div>
                </div>
                <div className="hidden sm:block w-36 lg:w-48 shrink-0">
                  <WrBar rate={c.rate} />
                </div>
                <div className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">
                  {c.games}g
                </div>
                <div className="w-12 shrink-0 text-right font-mono text-sm font-medium tabular">
                  {Math.round(c.rate * 100)}%
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        <BreakdownCard title="By seat" rows={seatRows} />
        <BreakdownCard title="By pod size" rows={podSizes} />
      </div>

      {/* Top win conditions */}
      {stats.topWinConditions.length > 0 && (
        <TopWinConditionsCard topWinConditions={stats.topWinConditions} />
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
