import { Badge } from "@/components/ui/badge"
import { CommanderCard } from "@/components/CommanderCard"
import type { Game } from "@/types"

interface GameHistoryRowProps {
  game: Game
  onClick: () => void
}

export function GameHistoryRow({ game, onClick }: GameHistoryRowProps) {
  const me = game.players.find((p) => p.isMe)
  const iWon = me && game.winnerId === me.id
  const date = new Date(game.playedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <button
      className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors space-y-2"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={iWon ? "default" : "secondary"} className="text-xs">
            {iWon ? "Win" : "Loss"}
          </Badge>
          <span className="text-xs text-muted-foreground">Turn {game.winTurn}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{game.players.length}p</span>
        </div>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>

      {me && (
        <div className="space-y-1">
          <CommanderCard
            commanderName={me.commanderName}
            imageUri={me.commanderImageUri}
            compact
          />
          {me.partnerName && (
            <CommanderCard
              commanderName={me.partnerName}
              imageUri={me.partnerImageUri}
              compact
            />
          )}
        </div>
      )}

      {me?.fastMana.hasFastMana && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Fast mana:</span>
          {me.fastMana.cards.length > 0 ? (
            <span className="text-xs">{me.fastMana.cards.join(", ")}</span>
          ) : (
            <span className="text-xs text-muted-foreground">yes</span>
          )}
        </div>
      )}
    </button>
  )
}
