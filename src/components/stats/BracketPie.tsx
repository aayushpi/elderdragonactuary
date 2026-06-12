import { useEffect, useState } from "react"
import { Cell, Legend, Pie, PieChart, Sector } from "recharts"
import { type PieSectorDataItem } from "recharts/types/polar/Pie"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { CARD, SECTION_LABEL } from "@/components/modern/primitives"

const chartConfig = {
  wins: { label: "Wins", color: "hsl(var(--primary))" },
} satisfies ChartConfig

interface BracketPieProps {
  byBracket: Array<{ bracket: number; wins: number; games: number }>
}

export function BracketPie({ byBracket }: BracketPieProps) {
  const data = byBracket.map((e) => ({
    bracketLabel: `Bracket ${e.bracket}`,
    games: e.games,
    wins: e.wins,
  }))

  const mostPlayed = byBracket.reduce(
    (best, e) => (e.games > best.games ? e : best),
    byBracket[0] ?? { bracket: 1, wins: 0, games: 0 }
  )
  const defaultLabel = `Bracket ${mostPlayed.bracket}`

  const [selected, setSelected] = useState(defaultLabel)

  useEffect(() => {
    const exists = data.some((e) => e.bracketLabel === selected)
    if (!selected || !exists) setSelected(defaultLabel)
  }, [defaultLabel, selected, data])

  const selectedEntry = data.find((e) => e.bracketLabel === selected)

  return (
    <div className="space-y-3">
      <div className={SECTION_LABEL}>Win rate by bracket</div>
      <div className={CARD + " p-4 sm:p-5 md:max-w-md"}>
        <div className="mb-3 flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-8 cursor-pointer rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {data.map((e) => (
              <option key={e.bracketLabel} value={e.bracketLabel}>
                {e.bracketLabel}
              </option>
            ))}
          </select>
          {selectedEntry && (
            <p className="font-mono text-xs text-muted-foreground tabular">
              {selectedEntry.wins} wins / {selectedEntry.games} games
            </p>
          )}
        </div>
        <ChartContainer config={chartConfig} className="rounded-md bg-muted/20 p-2">
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
                const item = payload?.[0]?.payload as
                  | { bracketLabel: string; wins: number; games: number }
                  | undefined
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
              data={data}
              dataKey="wins"
              nameKey="bracketLabel"
              cx="50%"
              cy="50%"
              outerRadius="85%"
              label={false}
              style={{ cursor: "pointer" }}
              onClick={(sliceData) => {
                const label = (sliceData as { bracketLabel?: string })?.bracketLabel
                if (label) setSelected(label)
              }}
              shape={(props: PieSectorDataItem & { payload?: { bracketLabel?: string } }) => {
                const { outerRadius = 0, payload, ...rest } = props
                const isActive = payload?.bracketLabel === selected
                if (!isActive) return <Sector {...props} />
                return (
                  <g>
                    <Sector {...rest} outerRadius={outerRadius + 8} />
                    <Sector {...rest} outerRadius={outerRadius + 18} innerRadius={outerRadius + 11} />
                  </g>
                )
              }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.bracketLabel}
                  fill={`url(#pattern-bracket-${index + 1})`}
                  opacity={entry.bracketLabel === selected ? 1 : 0.45}
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
      </div>
    </div>
  )
}
