import { useMemo, useState, useEffect, useCallback } from "react"
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
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
  const DEFAULT_VISIBLE = 4

  // Commander selection state: top 4 selected by default
  const [selected, setSelected] = useState<Set<string>>(() => {
    const top = commanders.slice(0, DEFAULT_VISIBLE).map((c) => c.name)
    return new Set(top)
  })

  const toggleCommander = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const addCommander = useCallback((name: string) => {
    if (!name) return
    setSelected((prev) => new Set(prev).add(name))
  }, [])

  useEffect(() => {
    // If commanders list changes (new data), ensure selected names exist
    setSelected((prev) => {
      const all = new Set(commanders.map((c) => c.name))
      const next = new Set<string>()
      for (const n of prev) if (all.has(n)) next.add(n)
      // ensure we have at least the top DEFAULT_VISIBLE selected
      if (next.size === 0) {
        for (const c of commanders.slice(0, DEFAULT_VISIBLE)) next.add(c.name)
      }
      return next
    })
  }, [commanders])

  const visibleCommanders = useMemo(() => commanders.filter((c) => selected.has(c.name)), [commanders, selected])
  const remainingCommanders = useMemo(() => commanders.filter((c) => !selected.has(c.name)), [commanders, selected])
  const chartCommanders = useMemo(() => visibleCommanders.filter((c) => c.games >= 2), [visibleCommanders])

  // Commander chart data (only for chartCommanders)
  const commanderChartData = useMemo(() => {
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
  }, [chartCommanders])

  // Pod selection state
  const [selectedPodKey, setSelectedPodKey] = useState<string>(podEloGroups[0]?.podKey ?? "")
  useEffect(() => {
    if (!podEloGroups || podEloGroups.length === 0) return
    const exists = podEloGroups.some((p) => p.podKey === selectedPodKey)
    if (!selectedPodKey || !exists) setSelectedPodKey(podEloGroups[0].podKey)
  }, [podEloGroups, selectedPodKey])

  const selectedPod = useMemo(() => podEloGroups.find((p) => p.podKey === selectedPodKey) ?? podEloGroups[0], [podEloGroups, selectedPodKey])

  // Pod selection handled inside pod tab; produce chart data per-pod when rendering

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          ELO
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1 text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="normal-case" side="top">
              <div className="text-sm max-w-xs normal-case">
                ELO is a rating system that estimates player/commander skill over time. Higher is better.
              </div>
            </PopoverContent>
          </Popover>
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
                            {chartCommanders.map((cmd, idx) => (
                              <linearGradient key={cmd.name} id={`cmd-elo-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.02} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.15)" />
                          <XAxis dataKey="game" tick={false} axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" label={{ value: 'Games', position: 'bottom', offset: 6, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <YAxis domain={["dataMin - 20", "dataMax + 20"]} hide />
                          <RechartTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                            labelStyle={{ fontWeight: 600 }}
                          />
                          {chartCommanders.map((cmd, idx) => (
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
                        {visibleCommanders.map((cmd, idx) => {
                          const color = COLORS[idx % COLORS.length]
                          return (
                            <tr key={cmd.name} className="border-t border-border/50">
                              <td className="py-1.5 pl-1">
                                <input
                                  type="checkbox"
                                  checked={selected.has(cmd.name)}
                                  onChange={() => toggleCommander(cmd.name)}
                                  className="h-3.5 w-3.5 rounded border-border/60 accent-primary cursor-pointer"
                                />
                              </td>
                              <td className="py-1.5 font-medium">
                                <span className="flex items-center gap-2">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
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

                    {/* Add commander dropdown */}
                    {remainingCommanders.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <select
                          value=""
                          onChange={(e) => addCommander(e.target.value)}
                          className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background text-foreground cursor-pointer"
                        >
                          <option value="" disabled>
                            + Add commander ({remainingCommanders.length} more)
                          </option>
                          {remainingCommanders.map((cmd) => (
                            <option key={cmd.name} value={cmd.name}>
                              {cmd.name} — {cmd.currentRating} ELO ({cmd.games}g)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pod">
              {podEloGroups.length === 0 || !selectedPod ? (
                <p className="text-sm text-muted-foreground mt-2">No pod ELO data yet.</p>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{selectedPod.label} <span className="text-xs text-muted-foreground">({selectedPod.totalGames}g)</span></h3>
                    {podEloGroups.length > 1 && (
                      <select
                        value={selectedPodKey}
                        onChange={(e) => setSelectedPodKey(e.target.value)}
                        className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground cursor-pointer max-w-[200px] truncate"
                      >
                        {podEloGroups.map((g) => (
                          <option key={g.podKey} value={g.podKey}>
                            {g.label} ({g.totalGames}g)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Build pod chart + leaderboard for selectedPod */}
                  {(() => {
                    const pod = selectedPod
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

                    const leaderboard = [...pod.players].sort((a, b) => b.currentRating - a.currentRating)

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div className="min-h-[220px]">
                          <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                              <defs>
                                {pod.players.map((player, idx) => (
                                  <linearGradient key={player.name} id={`elo-grad-${pod.podKey}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.02} />
                                  </linearGradient>
                                ))}
                              </defs>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.15)" />
                              <XAxis dataKey="game" tick={false} axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" label={{ value: 'Games', position: 'bottom', offset: 6, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
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
                    )
                  })()}
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
