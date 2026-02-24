import type { WinRateStat } from "@/types"

interface WinRateBarProps {
  label: string
  stat: WinRateStat
}

export function WinRateBar({ label, stat }: WinRateBarProps) {
  const pct = stat.games === 0 ? 0 : Math.round(stat.rate * 100)

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {stat.games === 0 ? "—" : `${pct}% (${stat.wins}/${stat.games})`}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
