import { useMemo, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent } from "@/components/ui/card"
import type { PodEloGroup, PodEloSnapshot } from "@/types"

const COLORS = ["#06b6d4", "#ef4444", "#eab308", "#10b981", "#8b5cf6", "#f97316"]

/** Tiny inline SVG sparkline for a player's ELO history */
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

interface PodEloCardProps {
  podEloGroups: PodEloGroup[]
}

export function PodEloCard({ podEloGroups }: PodEloCardProps) {
  const [selectedPodKey, setSelectedPodKey] = useState<string>(
    podEloGroups[0]?.podKey ?? "",
  )

  const pod = useMemo(
    () => podEloGroups.find((p) => p.podKey === selectedPodKey) ?? podEloGroups[0],
    [podEloGroups, selectedPodKey],
  )

  // Build chart data: one row per game, columns are each player's rating
  const chartData = useMemo(() => {
    if (!pod) return []

    // Collect all game indices in order
    const allIndices = new Set<number>()
    for (const player of pod.players) {
      for (const snap of player.history) allIndices.add(snap.gameIndex)
    }
    const indices = [...allIndices].sort((a, b) => a - b)

    // Build an initial row at index 0 (starting rating)
    const rows: Record<string, number | string>[] = []
    const start: Record<string, number | string> = { game: "Start" }
    for (const player of pod.players) start[player.name] = 1500
    rows.push(start)

    // Build a lookup per player: gameIndex → rating
    const lookups = new Map<string, Map<number, number>>()
    for (const player of pod.players) {
      const m = new Map<number, number>()
      for (const snap of player.history) m.set(snap.gameIndex, snap.rating)
      lookups.set(player.name, m)
    }

    let prev = start
    for (const idx of indices) {
      const row: Record<string, number | string> = { game: `Game ${idx}` }
      for (const player of pod.players) {
        row[player.name] = lookups.get(player.name)?.get(idx) ?? (prev[player.name] as number)
      }
      rows.push(row)
      prev = row
    }

    return rows
  }, [pod])

  if (podEloGroups.length === 0 || !pod) return null

  // Sort by current rating desc for the leaderboard
  const leaderboard = [...pod.players].sort((a, b) => b.currentRating - a.currentRating)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pod ELO
        </h2>
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

      {/* ELO chart + leaderboard — side by side on md+ */}
      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Graph half */}
            <div className="min-h-[220px]">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    {pod.players.map((player, idx) => (
                      <linearGradient key={player.name} id={`elo-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.15)" />
                  <XAxis
                    dataKey="game"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    domain={["dataMin - 20", "dataMax + 20"]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  {pod.players.map((player, idx) => (
                    <Area
                      key={player.name}
                      type="monotone"
                      dataKey={player.name}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      fill={`url(#elo-grad-${idx})`}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Table half */}
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
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          {player.name}
                        </span>
                      </td>
                      <td className="py-1.5 text-center">
                        <Sparkline history={player.history} color={color} />
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums">{player.currentRating}</td>
                      <td className="py-1.5 text-right tabular-nums">{player.wins}</td>
                      <td className="py-1.5 text-right tabular-nums">{player.games}</td>
                      <td className="py-1.5 text-right tabular-nums pr-1">
                        {player.games > 0 ? `${Math.round((player.wins / player.games) * 100)}%` : "—"}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
