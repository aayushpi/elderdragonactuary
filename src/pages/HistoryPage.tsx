import { useEffect, useMemo } from "react"
import { GameHistoryRow } from "@/components/GameHistoryRow"
import { GameDetailPanel } from "@/components/GameDetailPanel"

import type { Game } from "@/types"

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
  onEditGame: (id: string) => void
  scrollToGameId?: string | null
  onScrollHandled?: () => void
}

export function HistoryPage({ games, onDeleteGame, onEditGame, scrollToGameId, onScrollHandled }: HistoryPageProps) {
  // ── Sort games by date (newest first) ──────────────────────────────────────────────
  const displayedGames = useMemo(
    () =>
      [...games].sort(
        (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      ),
    [games]
  )

  useEffect(() => {
    if (!scrollToGameId || displayedGames.length === 0) return

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`game-${scrollToGameId}`)
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      onScrollHandled?.()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [scrollToGameId, displayedGames, onScrollHandled])

  // ── Render ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Empty state */}
      {displayedGames.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No games yet.</p>
        </div>
      ) : (
        /* Game list */
        <div className="space-y-2">
          {displayedGames.map((game) => (
            <div id={`game-${game.id}`} key={game.id} className="rounded-lg border border-border bg-card">
              {/* Game header */}
              <GameHistoryRow game={game} />

              {/* Expanded content */}
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
