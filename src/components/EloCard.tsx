import { useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { ManaCost } from "@/components/ManaCost"
import type { CommanderEloEntry, PodEloGroup, PodEloSnapshot } from "@/types"

const COLORS = ["#06b6d4", "#ef4444", "#eab308", "#10b981", "#8b5cf6", "#f97316"]

function Sparkline({ history, color }: { history: PodEloSnapshot[]; color: string }) {
  if (history.length < 2) return <span className="text-muted-foreground text-[10px]">—</span>

  const w = 72
  const h = 24
  const pad = 2
  const ratings = history.map((s) => s.rating)
  const min = Math.min(...ratings)
  const max = Math.max(...ratings)
  const range = max - min || 1

  const points = ratings.map((r, i) => {
    const x = pad + (i / (ratings.length - 1)) * (w - pad * 2)
    const y = h - pad - ((r - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface EloCardProps {
  commanders: CommanderEloEntry[]
  podEloGroups: PodEloGroup[]
}

export function EloCard({ commanders, podEloGroups }: EloCardProps) {
  // Commander chart data (only for commanders with 2+ games)
  const commanderChartData = useMemo(() => {
    const chartCommanders = commanders.filter((c) => c.games >= 2)
    if (chartCommanders.length === 0) return []

    let maxIdx = 0
    for (const cmd of chartCommanders) {
      for (const snap of cmd.history) {
        if (snap.gameIndex > maxIdx) maxIdx = snap.gameIndex
      }
    }

    const lookups = new Map<string, Map<number, number>>()
    for (const cmd of chartCommanders) {
      const m = new Map<number, number>()
      for (const snap of cmd.history) m.set(snap.gameIndex, snap.rating)
      lookups.set(cmd.name, m)
    }

    const rows: Record<string, number | string>[] = []
    const start: Record<string, number | string> = { game: "Start" }
    for (const cmd of chartCommanders) start[cmd.name] = 1500
    rows.push(start)

    let prev = start
    for (let idx = 1; idx <= maxIdx; idx++) {
      let hasData = false
      for (const cmd of chartCommanders) {
        if (lookups.get(cmd.name)?.has(idx)) { hasData = true; break }
      }
      if (!hasData) continue

      const row: Record<string, number | string> = { game: `Game ${idx}` }
      for (const cmd of chartCommanders) {
        row[cmd.name] = lookups.get(cmd.name)?.get(idx) ?? (prev[cmd.name] as number)
      }
      rows.push(row)
      prev = row
    }

    return rows
  }, [commanders])

  // Pod selection handled inside pod tab; produce chart data per-pod when rendering

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          ELO
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm max-w-xs">
                  ELO is a rating system that estimates player/commander skill over time. Higher is better.
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h2>
      </div>

      <Card>
        <CardContent className="pt-2 pb-2">
          <Tabs defaultValue="commander">
            <TabsList>
              <TabsTrigger value="commander">Commander ELO</TabsTrigger>
              <TabsTrigger value="pod">Pod ELO</TabsTrigger>
            </TabsList>

            <TabsContent value="commander">
              {commanders.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No commander ELO data yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {commanderChartData.length > 1 && (
                    <div className="min-h-[220px]">
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={commanderChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            {commanders.filter((c) => c.games >= 2).map((cmd, idx) => (
                              <linearGradient key={cmd.name} id={`cmd-elo-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.02} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.15)" />
                          <XAxis dataKey="game" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis domain={["dataMin - 20", "dataMax + 20"]} hide />
                          <RechartTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                            labelStyle={{ fontWeight: 600 }}
                          />
                          {commanders.filter((c) => c.games >= 2).map((cmd, idx) => (
                            <Area key={cmd.name} type="monotone" dataKey={cmd.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} fill={`url(#cmd-elo-grad-${idx})`} dot={false} activeDot={{ r: 4 }} />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="text-left pb-2 pl-1 w-8"></th>
                          <th className="text-left pb-2">Commander</th>
                          <th className="pb-2 text-center">Trend</th>
                          <th className="text-right pb-2">ELO</th>
                          <th className="text-right pb-2">W</th>
                          <th className="text-right pb-2">G</th>
                          <th className="text-right pb-2 pr-1">Win%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commanders.map((cmd, idx) => {
                          const color = COLORS[idx % COLORS.length]
                          return (
                            <tr key={cmd.name} className="border-t border-border/50">
                              <td className="py-1.5 pl-1">
                                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              </td>
                              <td className="py-1.5 font-medium">
                                <span className="flex items-center gap-2">
                                  <span className="truncate max-w-[120px]">{cmd.name}</span>
                                  {cmd.manaCost && <span className="shrink-0"><ManaCost cost={cmd.manaCost} size="xs" /></span>}
                                </span>
                              </td>
                              <td className="py-1.5 text-center"><Sparkline history={cmd.history} color={color} /></td>
                              <td className="py-1.5 text-right font-bold tabular-nums">{cmd.currentRating}</td>
                              <td className="py-1.5 text-right tabular-nums">{cmd.wins}</td>
                              <td className="py-1.5 text-right tabular-nums">{cmd.games}</td>
                              <td className="py-1.5 text-right tabular-nums pr-1">{cmd.games > 0 ? `${Math.round((cmd.wins / cmd.games) * 100)}%` : "—"}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pod">
              {podEloGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No pod ELO data yet.</p>
              ) : (
                <div>
                  {podEloGroups.map((pod) => {
                    const podChartData = (() => {
                      const allIndices = new Set<number>()
                      for (const player of pod.players) for (const snap of player.history) allIndices.add(snap.gameIndex)
                      const indices = [...allIndices].sort((a, b) => a - b)

                      const rows: Record<string, number | string>[] = []
                      const start: Record<string, number | string> = { game: "Start" }
                      for (const player of pod.players) start[player.name] = 1500
                      rows.push(start)

                      const lookups = new Map<string, Map<number, number>>()
                      for (const player of pod.players) {
                        const m = new Map<number, number>()
                        for (const snap of player.history) m.set(snap.gameIndex, snap.rating)
                        lookups.set(player.name, m)
                      }

                      let prev = start
                      for (const idx of indices) {
                        const row: Record<string, number | string> = { game: `Game ${idx}` }
                        for (const player of pod.players) row[player.name] = lookups.get(player.name)?.get(idx) ?? (prev[player.name] as number)
                        rows.push(row)
                        prev = row
                      }

                      return rows
                    })()

                    const leaderboard = [...pod.players].sort((a, b) => b.currentRating - a.currentRating)

                    return (
                      <div key={pod.podKey} className="space-y-2 mt-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium">{pod.label} <span className="text-xs text-muted-foreground">({pod.totalGames}g)</span></h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="min-h-[220px]">
                            <ResponsiveContainer width="100%" height={260}>
                              <AreaChart data={podChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <defs>
                                  {pod.players.map((player, idx) => (
                                    <linearGradient key={player.name} id={`elo-grad-${pod.podKey}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                                      <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.02} />
                                    </linearGradient>
                                  ))}
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.15)" />
                                <XAxis dataKey="game" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                <YAxis domain={["dataMin - 20", "dataMax + 20"]} hide />
                                <RechartTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ fontWeight: 600 }} />
                                {pod.players.map((player, idx) => (
                                  <Area key={player.name} type="monotone" dataKey={player.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} fill={`url(#elo-grad-${pod.podKey}-${idx})`} dot={false} activeDot={{ r: 4 }} />
                                ))}
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                                  <th className="text-left pb-2 pl-1">#</th>
                                  <th className="text-left pb-2">Player</th>
                                  <th className="pb-2 text-center">Trend</th>
                                  <th className="text-right pb-2">ELO</th>
                                  <th className="text-right pb-2">W</th>
                                  <th className="text-right pb-2">G</th>
                                  <th className="text-right pb-2 pr-1">Win%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leaderboard.map((player, rank) => {
                                  const colorIdx = pod.players.findIndex((p) => p.name === player.name)
                                  const color = COLORS[colorIdx % COLORS.length]
                                  return (
                                    <tr key={player.name} className="border-t border-border/50">
                                      <td className="py-1.5 pl-1 text-muted-foreground">{rank + 1}</td>
                                      <td className="py-1.5 font-medium">
                                        <span className="flex items-center gap-2">
                                          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                          {player.name}
                                        </span>
                                      </td>
                                      <td className="py-1.5 text-center"><Sparkline history={player.history} color={color} /></td>
                                      <td className="py-1.5 text-right font-bold tabular-nums">{player.currentRating}</td>
                                      <td className="py-1.5 text-right tabular-nums">{player.wins}</td>
                                      <td className="py-1.5 text-right tabular-nums">{player.games}</td>
                                      <td className="py-1.5 text-right tabular-nums pr-1">{player.games > 0 ? `${Math.round((player.wins / player.games) * 100)}%` : "—"}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default EloCard
