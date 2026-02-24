import { Card, CardContent } from "@/components/ui/card"
import type { WinRateStat } from "@/types"

interface StatCardProps {
  label: string
  stat?: WinRateStat
  value?: string | number
  description?: string
  className?: string
}

export function StatCard({ label, stat, value, description, className }: StatCardProps) {
  const displayValue = stat
    ? stat.games === 0
      ? "—"
      : `${Math.round(stat.rate * 100)}%`
    : value !== undefined
    ? String(value)
    : "—"

  const subtext = stat
    ? stat.games === 0
      ? "no games"
      : `${stat.wins}W / ${stat.games}G`
    : description

  return (
    <Card className={className}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1">{displayValue}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
      </CardContent>
    </Card>
  )
}
