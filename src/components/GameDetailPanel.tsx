import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CommanderCard } from "@/components/CommanderCard"
import type { Game } from "@/types"

interface GameDetailPanelProps {
  game: Game | undefined
  open: boolean
  onClose: () => void
}

export function GameDetailPanel({ game, open, onClose }: GameDetailPanelProps) {
  if (!game) return null

  const date = new Date(game.playedAt).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const winner = game.players.find((p) => p.id === game.winnerId)
  const me = game.players.find((p) => p.isMe)
  const iWon = me && game.winnerId === me.id
  const sortedPlayers = [...game.players].sort(
    (a, b) => (a.seatPosition ?? 99) - (b.seatPosition ?? 99)
  )

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant={iWon ? "default" : "secondary"}>{iWon ? "Win" : "Loss"}</Badge>
            <span className="font-normal text-muted-foreground text-sm">{date}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Players</p>
              <p className="font-medium">{game.players.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Win turn</p>
              <p className="font-medium">{game.winTurn}</p>
            </div>
            {winner && (
              <div>
                <p className="text-xs text-muted-foreground">Winner</p>
                <p className="font-medium">
                  {winner.isMe ? "You" : `Opp (${winner.commanderName})`}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Players</p>
            {sortedPlayers.map((player) => (
              <div key={player.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">
                    {player.seatPosition ? `#${player.seatPosition}` : "—"}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <CommanderCard
                      commanderName={player.commanderName}
                      imageUri={player.commanderImageUri}
                      compact
                    />
                    {player.partnerName && (
                      <CommanderCard
                        commanderName={player.partnerName}
                        imageUri={player.partnerImageUri}
                        compact
                      />
                    )}
                  </div>
                  {game.winnerId === player.id && (
                    <Badge className="ml-auto text-xs shrink-0">Winner</Badge>
                  )}
                </div>
                {player.fastMana.hasFastMana && (
                  <p className="text-xs text-muted-foreground ml-10">
                    Fast mana{player.fastMana.cards.length > 0 ? `: ${player.fastMana.cards.join(", ")}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>

          {game.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm">{game.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
