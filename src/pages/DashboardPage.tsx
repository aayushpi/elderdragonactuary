import { PlusCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/StatCard"
import { WinRateBar } from "@/components/WinRateBar"
import { useStats } from "@/hooks/useStats"
import type { AppView, Game } from "@/types"

const SEAT_ORDINALS: Record<number, string> = {
  1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th",
}

interface DashboardPageProps {
  games: Game[]
  onNavigate: (view: AppView) => void
}

export function DashboardPage({ games, onNavigate }: DashboardPageProps) {
  const stats = useStats(games)

  if (stats.gamesPlayed === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Your Commander stats</p>
        </div>
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-4">
          <div>
            <p className="text-muted-foreground text-sm">No games logged yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Log a game to see your stats here.</p>
          </div>
          <Button onClick={() => onNavigate("log-game")} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Log a new game
          </Button>
        </div>
      </div>
    )
  }

  const avgTurnDisplay =
    stats.averageWinTurn !== null
      ? stats.averageWinTurn.toFixed(1)
      : "—"

  // Only show seats that have at least 1 game
  const activeSeatEntries = (
    [
      [1, stats.bySeat.seat1],
      [2, stats.bySeat.seat2],
      [3, stats.bySeat.seat3],
      [4, stats.bySeat.seat4],
      [5, stats.bySeat.seat5],
      [6, stats.bySeat.seat6],
    ] as [number, (typeof stats.bySeat.seat1)][]
  ).filter(([, stat]) => stat.games > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <Button onClick={() => onNavigate("log-game")} size="sm" className="gap-1.5">
          <PlusCircle className="h-4 w-4" />
          Log a game
        </Button>
      </div>

      {/* Games logged card */}
      <div className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Games Logged</p>
          <p className="text-2xl font-bold mt-0.5">{stats.gamesPlayed}</p>
        </div>
        <button
          onClick={() => onNavigate("history")}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Game History
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Top stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Win Rate" stat={stats.overall} />
        <StatCard label="Avg Win Turn" value={avgTurnDisplay} description="when you win" />
        <StatCard label="With Fast Mana" stat={stats.withFastMana} />
        <StatCard label="vs Fast Mana" stat={stats.againstFastMana} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="seat">
        <TabsList className="w-full">
          <TabsTrigger value="seat" className="flex-1">Win rate by starting turn</TabsTrigger>
          <TabsTrigger value="winturn" className="flex-1">Win rate by win turn</TabsTrigger>
        </TabsList>

        <TabsContent value="seat" className="pt-4 space-y-3">
          {activeSeatEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No seat data yet.</p>
          ) : (
            activeSeatEntries.map(([seat, stat]) => (
              <WinRateBar
                key={seat}
                label={`${SEAT_ORDINALS[seat]} to play`}
                stat={stat}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="winturn" className="pt-4 space-y-3">
          {stats.byWinTurn.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No data yet.</p>
          ) : (
            stats.byWinTurn.map(({ turn, stat }) => (
              <WinRateBar key={turn} label={`Turn ${turn}`} stat={stat} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Performance by commander */}
      {stats.byCommander.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Performance by commander
          </h2>
          <div className="space-y-3">
            {stats.byCommander.map((c) => (
              <WinRateBar key={c.name} label={c.name} stat={{ wins: c.wins, games: c.games, rate: c.rate }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
