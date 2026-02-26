import { useMemo, useState, useEffect } from "react"
import { Plus, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GameHistoryRow } from "@/components/GameHistoryRow"
import { useStats } from "@/hooks/useStats"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Game } from "@/types"

interface DashboardPageProps {
  games: Game[]
  onNavigate: (path: string) => void
  onOpenLogGame: (commanderName?: string) => void
}

export function DashboardPage({ games, onNavigate, onOpenLogGame }: DashboardPageProps) {
  const stats = useStats(games)

  // early empty state mirrors StatsPage so users still see a call to action
  if (stats.gamesPlayed === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-4">
          <div>
            <p className="text-muted-foreground text-sm">No games logged yet.</p>
            <p className="text-muted-foreground text-xs mt-1">
              Log a game to see your stats here.
            </p>
          </div>
          <Button onClick={() => onOpenLogGame()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Track a game
            <kbd className="ml-0.5 text-[10px] font-mono bg-white/15 border border-white/25 px-1 py-0.5 rounded leading-none">
              N
            </kbd>
          </Button>
        </div>
      </div>
    )
  }

  const recentGames = useMemo(() => {
    return [...games]
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .slice(0, 3)
  }, [games])

  const topCommanders = useMemo(() => {
    return [...stats.byCommander]
      .sort((a, b) => b.games - a.games)
      .slice(0, 4)
  }, [stats.byCommander])

  // render helper for favorite commander cards
  function FavoriteCommanderCard({ name }: { name: string }) {
    const [artUri, setArtUri] = useState<string | undefined>()

    useEffect(() => {
      let cancelled = false
      async function load() {
        try {
          const card = await fetchCardByName(name)
          const crop = resolveArtCrop(card)
          if (!cancelled) setArtUri(crop ?? undefined)
        } catch {
          if (!cancelled) setArtUri(undefined)
        }
      }
      load()
      return () => {
        cancelled = true
      }
    }, [name])

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-lg border bg-card p-3 flex flex-col items-center">
              <img
                src={artUri ?? ""}
                alt={name}
                className="w-full h-32 rounded object-cover bg-muted"
              />
              <Button
                size="sm"
                className="mt-2 w-full gap-1.5"
                variant="outline"
                onClick={() => onOpenLogGame(name)}
              >
                <Plus className="h-4 w-4" />
                Track game
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <span>{name}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-6">
    {/* favorite commanders */}
      {topCommanders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your favorite commanders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {topCommanders.map((c) => (
              <FavoriteCommanderCard key={c.name} name={c.name} />
            ))}
          </div>
        </div>
      )}
       {/* recent games */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent games</h2>
          <button
            onClick={() => onNavigate("/history")}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Game History
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {recentGames.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">No games yet.</p>
        ) : (
          <div className="space-y-2 mt-2">
            {recentGames.map((game) => (
              <div
                key={game.id}
                className="rounded-lg border border-border bg-card"
              >
                <GameHistoryRow game={game} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
