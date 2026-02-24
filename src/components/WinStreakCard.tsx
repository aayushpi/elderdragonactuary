import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Game } from "@/types"

function commanderDisplayName(game: Game, playerId: string | undefined): string {
  if (!playerId) return "Unknown Commander"
  const player = game.players.find((p) => p.id === playerId)
  if (!player) return "Unknown Commander"
  return player.partnerName
    ? `${player.commanderName} // ${player.partnerName}`
    : player.commanderName
}

interface WinStreakCardProps {
  games: Game[]
}

export function WinStreakCard({ games }: WinStreakCardProps) {
  if (games.length === 0) {
    return null
  }

  // Get the last 10 games
  const recentGames = [...games].slice(0, 10)

  // Calculate current streak
  let currentStreak = 0
  let currentStreakType: "win" | "loss" | null = null

  for (const game of recentGames) {
    const me = game.players.find((p) => p.isMe)
    if (!me) continue

    const isWin = game.winnerId === me.id
    if (currentStreakType === null) {
      currentStreakType = isWin ? "win" : "loss"
      currentStreak = 1
    } else if ((isWin && currentStreakType === "win") || (!isWin && currentStreakType === "loss")) {
      currentStreak++
    } else {
      break
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              {currentStreak} {currentStreakType === "win" ? "win" : "loss"} Streak
            </p>
          </div>

          {/* Win/Loss Pips - Reversed so most recent is on the left */}
          <TooltipProvider delayDuration={200}>
            <div className="flex gap-1.5 items-center">
              {recentGames.map((game) => {
                const me = game.players.find((p) => p.isMe)
                if (!me) return null

                const isWin = game.winnerId === me.id
                const winningCommander = commanderDisplayName(game, game.winnerId)
                const losingCommander = commanderDisplayName(game, me.id)
                const date = new Date(game.playedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })

                return (
                  <Tooltip key={game.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold cursor-pointer transition-transform hover:scale-110 ${
                          isWin
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-600"
                            : "bg-red-500/20 border-red-500 text-red-600"
                        }`}
                      >
                        {isWin ? "W" : "L"}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <p className={isWin ? "text-emerald-400" : "text-red-400"}>
                          {isWin
                            ? `${winningCommander} won on turn ${game.winTurn}`
                            : `${losingCommander} lost to ${winningCommander} on turn ${game.winTurn}`}
                        </p>
                        <p className="text-muted-foreground">{date}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}
