import { useState, useEffect, useMemo } from "react"
import { Plus, ArrowRight, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react"
import { Cell, Legend, Pie, PieChart, Sector } from "recharts"
import { type PieSectorDataItem } from "recharts/types/polar/Pie"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NewGameMenu } from "@/components/NewGameMenu"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { ManaCost } from "@/components/ManaCost"
import { StatCard } from "@/components/StatCard"
import { WinRateBar } from "@/components/WinRateBar"
import { WinStreakCard } from "@/components/WinStreakCard"
import { TopWinConditionsCard } from "@/components/TopWinConditionsCard"
import { CommanderStatCard } from "@/components/CommanderStatCard"
import { EloCard } from "@/components/EloCard"
import { useStats } from "@/hooks/useStats"
import { computePodElo, computeCommanderElo } from "@/lib/stats"
import type { CommanderStat, Game } from "@/types"

const SEAT_ORDINALS: Record<number, string> = {
  1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th",
}

const bracketChartConfig = {
  wins: {
    label: "Wins",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

type CommanderSort = "win-rate" | "win-turn" | "total-wins"
type SortDirection = "asc" | "desc"

function colorIdentityToManaCost(colors: string[]): string {
  if (colors.length === 0) return "{C}"
  return colors.map((color) => `{${color}}`).join("")
}

function sortCommanders(commanders: CommanderStat[], sort: CommanderSort, direction: SortDirection): CommanderStat[] {
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

interface StatsPageProps {
  games: Game[]
  onNavigate: (path: string) => void
  onOpenLogGame: (commanderName?: string) => void
  onOpenLiveGame: (commanderName?: string) => void
  onResumeLiveGame: () => void
  hasLiveGame?: boolean
}

export function StatsPage({ games, onNavigate, onOpenLogGame, onOpenLiveGame, onResumeLiveGame, hasLiveGame = false }: StatsPageProps) {
  const stats = useStats(games)
  const podEloGroups = useMemo(() => computePodElo(games), [games])
  const commanderElo = useMemo(() => computeCommanderElo(games), [games])
  useEffect(() => {
    import('@/lib/analytics').then((mod) => {
      try { mod.trackViewStats({ stats_view: 'overall', games_played: stats.gamesPlayed }) } catch { void 0 }
    })
  }, [stats.gamesPlayed])
  const [commanderSort, setCommanderSort] = useState<CommanderSort>("win-rate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [selectedBracketLabel, setSelectedBracketLabel] = useState("")
  const [commanderExpanded, setCommanderExpanded] = useState(true)

  // derived data and bracket selection must be computed before any early return
  const sortedCommanders = sortCommanders(stats.byCommander, commanderSort, sortDirection)
  const bracketChartData = stats.byBracket.map((entry) => ({
    bracketLabel: `Bracket ${entry.bracket}`,
    games: entry.games,
    wins: entry.wins,
  }))
  const mostPlayedBracket = stats.byBracket.reduce(
    (best, entry) => (entry.games > best.games ? entry : best),
    stats.byBracket[0] ?? { bracket: 1, wins: 0, games: 0 }
  )
  const defaultBracketLabel = `Bracket ${mostPlayedBracket.bracket}`

  useEffect(() => {
    const selectedExists = bracketChartData.some((entry) => entry.bracketLabel === selectedBracketLabel)
    if (!selectedBracketLabel || !selectedExists) {
      setSelectedBracketLabel(defaultBracketLabel)
    }
  }, [defaultBracketLabel, selectedBracketLabel, bracketChartData])

  if (stats.gamesPlayed === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-4">
          <div>
            <p className="text-muted-foreground text-sm">No games logged yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Log a game to see your stats here.</p>
          </div>
          <NewGameMenu
            hasLiveGame={hasLiveGame}
            onQuickLog={onOpenLogGame}
            onStartLiveGame={onOpenLiveGame}
            onResumeLiveGame={onResumeLiveGame}
            trigger={
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" />
                Track a game
                <kbd className="ml-0.5 text-[10px] font-mono bg-white/15 border border-white/25 px-1 py-0.5 rounded leading-none">
                  N
                </kbd>
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const avgTurnDisplay =
    stats.averageWinTurn !== null
      ? stats.averageWinTurn.toFixed(1)
      : "—"

  // Only show seats that have at least 1 game
  const activeSeatEntries = (
    [
      [1, stats.bySeat.seat1],
      [2, stats.bySeat.seat2],
      [3, stats.bySeat.seat3],
      [4, stats.bySeat.seat4],
      [5, stats.bySeat.seat5],
      [6, stats.bySeat.seat6],
    ] as [number, (typeof stats.bySeat.seat1)][]
  ).filter(([, stat]) => stat.games > 0)

  const selectedBracket = bracketChartData.find((entry) => entry.bracketLabel === selectedBracketLabel)

  return (
    <div className="space-y-6">
      {/* Games logged card */}
      <div className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Games Logged</p>
          <p className="text-2xl font-bold mt-0.5">{stats.gamesPlayed}</p>
        </div>
        <button
          onClick={() => onNavigate("/history")}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Game History
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Top stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Win Rate" stat={stats.overall} />
        <StatCard label="Avg Win Turn" value={avgTurnDisplay} description="when you win" />
        <StatCard label="With Fast Mana" stat={stats.withFastMana} />
        <StatCard label="vs Fast Mana" stat={stats.againstFastMana} />
      </div>

      {/* Win streak and top win conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WinStreakCard games={games} />
        <TopWinConditionsCard topWinConditions={stats.topWinConditions} />
      </div>

      {/* Win rate by starting turn */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Win rate by starting turn
        </h2>
        {activeSeatEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No seat data yet.</p>
        ) : (
          activeSeatEntries.map(([seat, stat]) => (
            <WinRateBar
              key={seat}
              label={`${SEAT_ORDINALS[seat]} to play`}
              stat={stat}
            />
          ))
        )}
      </div>

      {/* Win rate by bracket */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Win rate by bracket
        </h2>
        <Card className="w-full md:w-1/2">
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center gap-2">
              <select
                value={selectedBracketLabel}
                onChange={(e) => setSelectedBracketLabel(e.target.value)}
                className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground cursor-pointer"
              >
                {bracketChartData.map((entry) => (
                  <option key={entry.bracketLabel} value={entry.bracketLabel}>
                    {entry.bracketLabel}
                  </option>
                ))}
              </select>
              {selectedBracket && (
                <p className="text-xs text-muted-foreground">
                  {selectedBracket.wins} wins / {selectedBracket.games} games
                </p>
              )}
            </div>
            <ChartContainer config={bracketChartConfig} className="rounded-md bg-muted/20 p-2">
              <PieChart accessibilityLayer>
                  <defs>
                    <pattern id="pattern-bracket-1" patternUnits="userSpaceOnUse" width="8" height="8">
                      <rect width="8" height="8" fill="hsl(var(--bracket-1))" />
                      <path d="M0 0L8 8" stroke="hsl(var(--background) / 0.45)" strokeWidth="1" />
                    </pattern>
                    <pattern id="pattern-bracket-2" patternUnits="userSpaceOnUse" width="8" height="8">
                      <rect width="8" height="8" fill="hsl(var(--bracket-2))" />
                      <path d="M0 4H8" stroke="hsl(var(--background) / 0.45)" strokeWidth="1" />
                    </pattern>
                    <pattern id="pattern-bracket-3" patternUnits="userSpaceOnUse" width="8" height="8">
                      <rect width="8" height="8" fill="hsl(var(--bracket-3))" />
                      <path d="M4 0V8" stroke="hsl(var(--background) / 0.45)" strokeWidth="1" />
                    </pattern>
                    <pattern id="pattern-bracket-4" patternUnits="userSpaceOnUse" width="8" height="8">
                      <rect width="8" height="8" fill="hsl(var(--bracket-4))" />
                      <circle cx="2" cy="2" r="1" fill="hsl(var(--background) / 0.45)" />
                      <circle cx="6" cy="6" r="1" fill="hsl(var(--background) / 0.45)" />
                    </pattern>
                    <pattern id="pattern-bracket-5" patternUnits="userSpaceOnUse" width="8" height="8">
                      <rect width="8" height="8" fill="hsl(var(--bracket-5))" />
                      <path d="M0 8L8 0" stroke="hsl(var(--background) / 0.45)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <ChartTooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      const item = payload?.[0]?.payload as { bracketLabel: string; wins: number; games: number } | undefined
                      if (!active || !item) return null

                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                          <span className="font-medium text-foreground">
                            {item.bracketLabel}: {item.wins} wins from {item.games} total games
                          </span>
                        </div>
                      )
                    }}
                  />
                  <Pie
                    data={bracketChartData}
                    dataKey="wins"
                    nameKey="bracketLabel"
                    cx="50%"
                    cy="50%"
                    outerRadius="85%"
                    label={false}
                    style={{ cursor: "pointer" }}
                    onClick={(sliceData) => {
                      const label = (sliceData as { bracketLabel?: string })?.bracketLabel
                      if (label) setSelectedBracketLabel(label)
                    }}
                    shape={(props: PieSectorDataItem & { payload?: { bracketLabel?: string } }) => {
                      const { outerRadius = 0, payload, ...rest } = props
                      const isActive = payload?.bracketLabel === selectedBracketLabel

                      if (!isActive) {
                        return <Sector {...props} />
                      }

                      return (
                        <g>
                          <Sector {...rest} outerRadius={outerRadius + 8} />
                          <Sector
                            {...rest}
                            outerRadius={outerRadius + 18}
                            innerRadius={outerRadius + 11}
                          />
                        </g>
                      )
                    }}
                  >
                    {bracketChartData.map((entry, index) => (
                      <Cell
                        key={entry.bracketLabel}
                        fill={`url(#pattern-bracket-${index + 1})`}
                        opacity={entry.bracketLabel === selectedBracketLabel ? 1 : 0.45}
                        stroke="hsl(var(--border))"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    layout="horizontal"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stats about your commander colors */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Commander colors
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Most played</p>
              {stats.mostPlayedCommanderColorIdentity ? (
                <>
                  <div className="mt-2">
                    <ManaCost cost={colorIdentityToManaCost(stats.mostPlayedCommanderColorIdentity.colors)} size="sm" />
                  </div>
                  <p className="text-2xl font-bold mt-1 leading-none">{stats.mostPlayedCommanderColorIdentity.games} game{stats.mostPlayedCommanderColorIdentity.games !== 1 ? "s" : ""}</p>

                </>
              ) : (
                <p className="text-2xl font-bold mt-1 leading-none">—</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Most successful</p>
              {stats.mostSuccessfulCommanderColorIdentity ? (
                <>
                  <div className="mt-2">
                    <ManaCost cost={colorIdentityToManaCost(stats.mostSuccessfulCommanderColorIdentity.colors)} size="sm" />
                  </div>
                  <p className="text-2xl font-bold mt-1 leading-none">
                    {Math.round(stats.mostSuccessfulCommanderColorIdentity.winRate * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.mostSuccessfulCommanderColorIdentity.wins} wins / {stats.mostSuccessfulCommanderColorIdentity.games} games
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold mt-1 leading-none">—</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Archnemesis colors</p>
              {stats.archnemesisCommanderColorIdentity ? (
                <>
                  <div className="mt-2">
                    <ManaCost cost={colorIdentityToManaCost(stats.archnemesisCommanderColorIdentity.colors)} size="sm" />
                  </div>
                  <p className="text-2xl font-bold mt-1 leading-none">
                    {Math.round(stats.archnemesisCommanderColorIdentity.lossRate * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.archnemesisCommanderColorIdentity.games - stats.archnemesisCommanderColorIdentity.wins} losses / {stats.archnemesisCommanderColorIdentity.games} games
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold mt-1 leading-none">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ELO */}
      {(podEloGroups.length > 0 || commanderElo.length > 0) && (
        <EloCard podEloGroups={podEloGroups} commanders={commanderElo} />
      )}

      {/* Commander performance */}
      {stats.byCommander.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCommanderExpanded(!commanderExpanded)}
              className="flex items-center gap-2 text-left"
            >
              {commanderExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Commander performance
              </h2>
            </button>
            {commanderExpanded && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Sort by</span>
                <select
                  value={commanderSort}
                  onChange={(e) => setCommanderSort(e.target.value as CommanderSort)}
                  className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground cursor-pointer"
                >
                  <option value="win-rate">Win rate</option>
                  <option value="win-turn">Winning turn</option>
                  <option value="total-wins">Total wins</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortDirection === "asc" ? "Asc" : "Desc"}
                </Button>
              </div>
            )}
          </div>
          {commanderExpanded && (
            <div className="space-y-3">
              {sortedCommanders.map((c, i) => (
                <CommanderStatCard key={c.name} stat={c} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}