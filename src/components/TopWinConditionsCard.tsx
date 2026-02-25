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
          
          <div className="space-y-2">
            {topWinConditions.map((wc, index) => (
              <div 
                key={wc.condition}
                className="flex items-center gap-3"
              >
                <div className="text-xl font-bold text-muted-foreground w-6 text-center">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="text-xs">
                    {wc.condition}
                  </Badge>
                </div>
                <div className="text-sm font-semibold text-muted-foreground">
                  {wc.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
