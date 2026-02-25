import { useEffect, useMemo, useState } from "react"
import { GameHistoryRow } from "@/components/GameHistoryRow"
import { GameDetailPanel } from "@/components/GameDetailPanel"

import type { Game } from "@/types"

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
  onEditGame: (id: string) => void
}

export function HistoryPage({ games, onDeleteGame, onEditGame }: HistoryPageProps) {
  // ── Sort games by date (newest first) ──────────────────────────────────────────────
  const displayedGames = useMemo(
    () =>
      [...games].sort(
        (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      ),
    [games]
  )

  // ── Accordion state: which game is expanded ─────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Auto-expand top item on mount or when expanded game is deleted ─────────────────
  useEffect(() => {
    setExpandedId((current) => {
      if (displayedGames.length === 0) return null
      if (!current) return displayedGames[0].id
      return displayedGames.some((game) => game.id === current)
        ? current
        : displayedGames[0].id
    })
  }, [displayedGames])

  // ── Render ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Empty state */}
      {displayedGames.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No games yet.</p>
        </div>
      ) : (
        /* Game list with accordion items */
        <div className="space-y-2">
          {displayedGames.map((game) => (
            <div key={game.id} className="rounded-lg border border-border bg-card relative z-50">
              {/* Accordion header */}
              <GameHistoryRow
                game={game}
                isOpen={expandedId === game.id}
                onClick={() => setExpandedId(game.id)}
              />

              {/* Animated expanded content - always open on mobile, accordion on desktop */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out grid-rows-[1fr] opacity-100 sm:grid-rows-[0fr] sm:opacity-0 ${expandedId === game.id ? "sm:grid-rows-[1fr] sm:opacity-100" : ""}`}
              >
                <div className="min-h-0">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
