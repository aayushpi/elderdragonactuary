import { useMemo } from "react"
import { GameHistoryRow } from "@/components/GameHistoryRow"
import { GameDetailPanel } from "@/components/GameDetailPanel"

import type { Game } from "@/types"

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
  onEditGame: (id: string) => void
}

export function HistoryPage({ games, onDeleteGame, onEditGame }: HistoryPageProps) {
  const displayedGames = useMemo(
    () =>
      [...games].sort(
        (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      ),
    [games]
  )

  return (
    <div className="space-y-4">
      {displayedGames.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No games yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedGames.map((game) => (
            <div key={game.id} className="rounded-lg border border-border bg-card">
              <GameHistoryRow game={game} />

              <div className="px-3 pb-3 border-t border-border">
                <div className="pt-3">
                  <GameDetailPanel
                    game={game}
                    onEdit={() => onEditGame(game.id)}
                    onDelete={() => onDeleteGame(game.id)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
