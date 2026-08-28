import { useMemo, useState, useEffect } from "react"
import { Plus, ArrowRight } from "lucide-react"
import { useStats } from "@/hooks/useStats"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import { CARD, SECTION_LABEL, Pips } from "@/components/modern/primitives"
import { GameRow } from "@/components/modern/GameRow"
import { CommanderSearch } from "@/components/CommanderSearch"
import { copy } from "@/copy"
import type { Game, MtgColor } from "@/types"

interface DashboardPageProps {
  games: Game[]
  onNavigate: (path: string) => void
  onOpenLogGame: (commanderName?: string) => void
  onEditGame: (id: string) => void
}

const SEAT_ORDINAL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th" }

/** Map each commander name to the color identity seen for "me" in any game. */
function buildColorMap(games: Game[]): Map<string, MtgColor[]> {
  const map = new Map<string, MtgColor[]>()
  for (const g of games) {
    const me = g.players.find((p) => p.isMe)
    if (me && me.commanderColorIdentity && !map.has(me.commanderName)) {
      map.set(me.commanderName, me.commanderColorIdentity)
    }
  }
  return map
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={CARD + " p-4 sm:p-5"}>
      <div className={SECTION_LABEL}>{label}</div>
      <div
        className={
          "mt-2.5 text-[28px] sm:text-3xl font-semibold tracking-tight tabular truncate " +
          (highlight ? "text-primary" : "")
        }
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function FavoriteCard({
  name,
  colors,
  games,
  rate,
  onTrack,
}: {
  name: string
  colors: MtgColor[]
  games: number
  rate: number
  onTrack: () => void
}) {
  const [artUri, setArtUri] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    fetchCardByName(name)
      .then((card) => {
        if (!cancelled) setArtUri(resolveArtCrop(card) ?? undefined)
      })
      .catch(() => {
        if (!cancelled) setArtUri(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [name])

  return (
    <div data-carousel-card className={CARD + " flex-shrink-0 w-52 snap-start overflow-hidden"}>
      <div className="art-ph relative h-28 w-full border-b border-border grid place-items-center overflow-hidden">
        {artUri ? (
          <img src={artUri} alt={name} className="h-full w-full object-cover object-center" />
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            commander art
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="text-sm font-semibold truncate" title={name}>
          {name}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Pips colors={colors} />
          <span className="font-mono text-[11px] text-muted-foreground tabular">
            {games}g · {Math.round(rate * 100)}%
          </span>
        </div>
        <button
          onClick={onTrack}
          className="mt-3 inline-flex items-center justify-center gap-2 h-9 w-full text-sm rounded-md font-medium border border-input bg-transparent text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          {copy.dashboard.trackGame}
        </button>
      </div>
    </div>
  )
}

export function DashboardPage({ games, onNavigate, onOpenLogGame, onEditGame }: DashboardPageProps) {
  const stats = useStats(games)
  const colorMap = useMemo(() => buildColorMap(games), [games])

  const recentGames = useMemo(
    () =>
      [...games]
        .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
        .slice(0, 6),
    [games]
  )

  const topCommanders = useMemo(
    () => [...stats.byCommander].sort((a, b) => b.games - a.games).slice(0, 8),
    [stats.byCommander]
  )

  const bestSeat = useMemo(() => {
    const entries = [
      [1, stats.bySeat.seat1],
      [2, stats.bySeat.seat2],
      [3, stats.bySeat.seat3],
      [4, stats.bySeat.seat4],
      [5, stats.bySeat.seat5],
      [6, stats.bySeat.seat6],
    ] as const
    return entries
      .filter(([, s]) => s.games > 0)
      .reduce<{ seat: number; rate: number } | null>((best, [seat, s]) => {
        if (!best || s.rate > best.rate) return { seat, rate: s.rate }
        return best
      }, null)
  }, [stats.bySeat])

  const topCommander = topCommanders[0]

  if (stats.gamesPlayed === 0) {
    return (
      <div className="space-y-8">
        <CommanderSearch
          value=""
          onChange={(name) => name && onOpenLogGame(name)}
          placeholder={copy.dashboard.searchPlaceholder}
        />
        <div className={CARD + " p-12 text-center"}>
          <p className="text-sm font-medium">{copy.dashboard.empty.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.dashboard.empty.body}</p>
          <button
            onClick={() => onOpenLogGame()}
            className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-6 text-[15px] rounded-md font-medium bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {copy.dashboard.empty.cta}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Search */}
      <CommanderSearch
        value=""
        onChange={(name) => name && onOpenLogGame(name)}
        placeholder={copy.dashboard.searchPlaceholder}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={copy.dashboard.games} value={String(stats.gamesPlayed)} sub={copy.dashboard.gamesSub} />
        <StatCard
          label={copy.dashboard.winRate}
          value={stats.overall.games ? `${Math.round(stats.overall.rate * 100)}%` : "—"}
          sub={copy.dashboard.winRateSub(stats.overall.wins, stats.overall.games)}
          highlight
        />
        <StatCard
          label={copy.dashboard.bestSeat}
          value={bestSeat ? String(bestSeat.seat) : "—"}
          sub={bestSeat ? copy.dashboard.bestSeatSub(Math.round(bestSeat.rate * 100), SEAT_ORDINAL[bestSeat.seat]) : copy.dashboard.noSeatData}
        />
        <StatCard
          label={copy.dashboard.topCommander}
          value={topCommander ? topCommander.name.split(",")[0] : "—"}
          sub={
            topCommander
              ? copy.dashboard.topCommanderSub(Math.round(topCommander.rate * 100), topCommander.games)
              : copy.stats.noGames
          }
        />
      </div>

      {/* Favorites */}
      {topCommanders.length > 0 && (
        <section>
          <h2 className={SECTION_LABEL}>{copy.dashboard.favoriteCommanders}</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {topCommanders.map((c) => (
              <FavoriteCard
                key={c.name}
                name={c.name}
                colors={colorMap.get(c.name) ?? []}
                games={c.games}
                rate={c.rate}
                onTrack={() => onOpenLogGame(c.name)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent games */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className={SECTION_LABEL}>{copy.dashboard.recentGames}</h2>
          <button
            onClick={() => onNavigate("/history")}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {copy.dashboard.gameHistory} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {recentGames.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{copy.dashboard.noGamesYet}</p>
        ) : (
          <div className={CARD + " mt-3 divide-y divide-border overflow-hidden"}>
            {recentGames.map((g) => (
              <GameRow key={g.id} game={g} onEdit={onEditGame} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
