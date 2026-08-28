import { useMemo, useState } from "react"
import { copy } from "@/copy"
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
import { ManaCost } from "@/components/ManaCost"
import type { CommanderEloEntry, PodEloSnapshot } from "@/types"

const COLORS = ["#06b6d4", "#ef4444", "#eab308", "#10b981", "#8b5cf6", "#f97316"]

/** Tiny inline SVG sparkline */
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

interface CommanderEloCardProps {
  commanders: CommanderEloEntry[]
}

const DEFAULT_VISIBLE = 4

export function CommanderEloCard({ commanders }: CommanderEloCardProps) {
  // Selected commander names (top 4 by default)
  const [selected, setSelected] = useState<Set<string>>(() => {
    const top = commanders.slice(0, DEFAULT_VISIBLE).map((c) => c.name)
    return new Set(top)
  })

  const toggleCommander = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const addCommander = (name: string) => {
    if (!name) return
    setSelected((prev) => new Set(prev).add(name))
  }

  // Commanders currently shown in the list (selected ones, in rating order)
  const visibleCommanders = useMemo(
    () => commanders.filter((c) => selected.has(c.name)),
    [commanders, selected],
  )

  // Commanders available to add via dropdown
  const remainingCommanders = useMemo(
    () => commanders.filter((c) => !selected.has(c.name)),
    [commanders, selected],
  )

  // Only chart selected commanders with 2+ games
  const chartCommanders = useMemo(
    () => visibleCommanders.filter((c) => c.games >= 2),
    [visibleCommanders],
  )

  const chartData = useMemo(() => {
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
    const start: Record<string, number | string> = { game: copy.elo.startPoint }
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

  if (commanders.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Commander ELO
      </h2>

      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Graph half */}
            {chartData.length > 1 && (
              <div className="min-h-[220px]">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      {chartCommanders.map((cmd, idx) => (
                        <linearGradient key={cmd.name} id={`cmd-elo-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
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
                    {chartCommanders.map((cmd, idx) => (
                      <Area
                        key={cmd.name}
                        type="monotone"
                        dataKey={cmd.name}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        fill={`url(#cmd-elo-grad-${idx})`}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table half */}
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
                  {visibleCommanders.map((cmd) => {
                    const chartIdx = chartCommanders.findIndex((c) => c.name === cmd.name)
                    const color = chartIdx >= 0 ? COLORS[chartIdx % COLORS.length] : "hsl(var(--muted-foreground))"
                    return (
                    <tr key={cmd.name} className="border-t border-border/50">
                      <td className="py-1.5 pl-1">
                        <input
                          type="checkbox"
                          checked={selected.has(cmd.name)}
                          onChange={() => toggleCommander(cmd.name)}
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-1.5 font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate max-w-[120px]">{cmd.name}</span>
                          {cmd.manaCost && (
                            <span className="shrink-0">
                              <ManaCost cost={cmd.manaCost} size="xs" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 text-center">
                        <Sparkline history={cmd.history} color={color} />
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums">{cmd.currentRating}</td>
                      <td className="py-1.5 text-right tabular-nums">{cmd.wins}</td>
                      <td className="py-1.5 text-right tabular-nums">{cmd.games}</td>
                      <td className="py-1.5 text-right tabular-nums pr-1">
                        {cmd.games > 0 ? `${Math.round((cmd.wins / cmd.games) * 100)}%` : "—"}
                      </td>
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
        </CardContent>
      </Card>
    </div>
  )
}
