import { useState } from "react"
import { GameHistoryRow } from "@/components/GameHistoryRow"
import { GameDetailPanel } from "@/components/GameDetailPanel"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import type { Game } from "@/types"

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
}

export function HistoryPage({ games, onDeleteGame }: HistoryPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedGame = games.find((g) => g.id === selectedId)

  return (
    <div className="space-y-4">
      {games.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No games yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((game) => (
            <div key={game.id} className="relative group">
              <GameHistoryRow game={game} onClick={() => setSelectedId(game.id)} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteGame(game.id)
                }}
                title="Delete game"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <GameDetailPanel
        game={selectedGame}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
