import { useEffect } from "react"
import { VariantJourney } from "@/components/prototypes/historyTimeline/VariantJourney"
import { capture } from "@/lib/analytics"
import type { Game } from "@/types"

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
  onEditGame: (id: string) => void
  scrollToGameId?: string | null
  onScrollHandled?: () => void
}

export function HistoryPage({
  games,
  onDeleteGame,
  onEditGame,
  scrollToGameId,
  onScrollHandled,
}: HistoryPageProps) {
  useEffect(() => {
    capture("history_viewed", { games_count: games.length })
    // Fires once per visit, not on every add/delete — the metric is "opened
    // history", and games.length changing under the user is not a new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">History</h1>
      <VariantJourney
        games={games}
        onEditGame={onEditGame}
        onDeleteGame={onDeleteGame}
        scrollToGameId={scrollToGameId}
        onScrollHandled={onScrollHandled}
      />
    </div>
  )
}
