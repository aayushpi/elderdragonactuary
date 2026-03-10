import { useMemo, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

type Player = { id: string; name: string; rating: number }
type CommanderRating = { commanderId: string; commanderName: string; rating: number }
type Pod = { id: string; name: string; players: Player[] }

export default function EloStatsCards({
  players = [],
  commanderRatings = {},
  pods = [],
}: {
  players?: Player[]
  commanderRatings?: Record<string, CommanderRating[]>
  pods?: Pod[]
}) {
  const [selectedCommanderPlayer, setSelectedCommanderPlayer] = useState<string | null>(
    players[0]?.id ?? null
  )
  const [selectedPod, setSelectedPod] = useState<string | null>(pods[0]?.id ?? null)

  // Mock time series data generator for demonstration
  function timeseriesFromStart(rating: number) {
    const out = [] as { date: string; value: number }[]
    for (let i = 0; i < 12; i++) {
      out.push({ date: `${i + 1}w`, value: Math.round(rating + (Math.sin(i / 2) * 40 + (i - 6) * 2)) })
    }
    return out
  }

  // Build a player's series: prefer explicit player.rating; otherwise average their commander ratings
  function playerSeries(player: Player) {
    if (typeof player.rating === "number") return timeseriesFromStart(player.rating)
    const cmds = commanderRatings[player.id]
    if (!cmds || cmds.length === 0) return timeseriesFromStart(1500)

    const seriesPerCommander = cmds.map((c) => timeseriesFromStart(c.rating))
    const len = seriesPerCommander[0].length
    const avgSeries: { date: string; value: number }[] = []
    for (let i = 0; i < len; i++) {
      const date = seriesPerCommander[0][i].date
      const sum = seriesPerCommander.reduce((s, arr) => s + (arr[i]?.value ?? 0), 0)
      avgSeries.push({ date, value: Math.round(sum / seriesPerCommander.length) })
    }
    return avgSeries
  }

  const overallSeries = useMemo(() => {
    return players.map((p) => ({ id: p.id, name: p.name, series: timeseriesFromStart(p.rating) }))
  }, [players])

  const commanderOptions = useMemo(() => {
    if (!selectedCommanderPlayer) return [] as CommanderRating[]
    return commanderRatings[selectedCommanderPlayer] ?? []
  }, [commanderRatings, selectedCommanderPlayer])

  const pod = useMemo(() => pods.find((p) => p.id === selectedPod) ?? pods[0], [pods, selectedPod])
  const colors = ["#06b6d4", "#ef4444", "#eab308", "#10b981", "#8b5cf6", "#f97316"]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Overall ELO */}
      <Card>
        <CardHeader>
          <CardTitle>Overall ELO</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer id="overall" config={{}}
          >
            <LineChart data={overallSeries[0]?.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<ChartTooltipContent />} />
              {overallSeries.slice(0, 3).map((s, idx) => (
                <Line key={s.id} type="monotone" dataKey="value" data={s.series} name={s.name} stroke={["var(--primary)", "#eab308", "#06b6d4"][idx % 3]} dot={false} />
              ))}
              <Legend />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Per-Commander */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Per-Commander ELO</CardTitle>
            </div>
            <select
              value={selectedCommanderPlayer ?? ""}
              onChange={(e) => setSelectedCommanderPlayer(e.target.value || null)}
              className="rounded border px-2 py-1 text-sm"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer id="commander" config={{}}>
            <LineChart data={commanderOptions[0] ? timeseriesFromStart(commanderOptions[0].rating) : []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<ChartTooltipContent />} />
              {commanderOptions.map((c, i) => (
                <Line key={c.commanderId} type="monotone" dataKey="value" data={timeseriesFromStart(c.rating)} name={c.commanderName} stroke={i === 0 ? "var(--primary)" : "#8884d8"} dot={false} />
              ))}
              <Legend />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Pod ELO */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Pod ELO</CardTitle>
            </div>
            <select
              value={selectedPod ?? ""}
              onChange={(e) => setSelectedPod(e.target.value || null)}
              className="rounded border px-2 py-1 text-sm"
            >
              {pods.map((p) => (
                <option key={p.id} value={p.id}>{p.players.map((pl) => pl.name).join(", ")}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer id="pod" config={{}}>
            <LineChart data={pod?.players[0] ? timeseriesFromStart(pod.players[0].rating) : []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<ChartTooltipContent />} />
              {pod?.players.map((pl, idx) => (
                <Line
                  key={pl.id}
                  type="monotone"
                  dataKey="value"
                  data={playerSeries(pl)}
                  name={pl.name}
                  stroke={colors[idx % colors.length]}
                  dot={false}
                />
              ))}
              <Legend />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
