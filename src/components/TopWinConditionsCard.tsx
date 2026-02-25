import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface WinConditionStat {
  condition: string
  count: number
}

interface TopWinConditionsCardProps {
  topWinConditions: WinConditionStat[]
}

export function TopWinConditionsCard({ topWinConditions }: TopWinConditionsCardProps) {
  if (topWinConditions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            Top Ways to Win
          </p>
          
          <div className="flex flex-wrap gap-2">
            {topWinConditions.map((wc) => (
              <Badge 
                key={wc.condition}
                variant="outline" 
                className="text-xs"
              >
                {wc.condition} × {wc.count}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
