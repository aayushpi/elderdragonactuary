import { VariantJourney } from "@/components/prototypes/historyTimeline/VariantJourney"
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
