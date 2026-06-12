import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { GameDetailPanel } from "@/components/GameDetailPanel"
import { GameRow } from "@/components/modern/GameRow"
import { CARD, SECTION_LABEL } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"

// ── Pod helpers ──────────────────────────────────────────────────────────────

function podKeyForGame(game: Game): string | null {
  const names = game.players.map((p) => p.displayName?.trim()).filter(Boolean) as string[]
  if (names.length !== game.players.length || names.length === 0) return null
  return [...names].sort((a, b) => a.localeCompare(b)).join("|||")
}

interface PodGroup {
  key: string
  label: string
  players: string[]
  games: Game[]
  latestDate: number
}

function buildPodGroups(games: Game[]): PodGroup[] {
  const map = new Map<string, PodGroup>()
  for (const game of games) {
    const key = podKeyForGame(game)
    if (!key) continue
    let group = map.get(key)
    if (!group) {
      const players = [...new Set(game.players.map((p) => p.displayName!.trim()))].sort((a, b) =>
        a.localeCompare(b)
      )
      group = { key, label: players.join(", "), players, games: [], latestDate: 0 }
      map.set(key, group)
    }
    group.games.push(game)
    const ts = new Date(game.playedAt).getTime()
    if (ts > group.latestDate) group.latestDate = ts
  }
  for (const group of map.values()) {
    group.games.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
  }
  return Array.from(map.values()).sort((a, b) => b.latestDate - a.latestDate)
}

// ── Month grouping helpers ───────────────────────────────────────────────────

interface MonthGroup {
  label: string
  key: string
  games: Game[]
}

function groupByMonth(sortedGames: Game[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  let current: MonthGroup | null = null
  for (const game of sortedGames) {
    const d = new Date(game.playedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!current || current.key !== key) {
      const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      current = { label, key, games: [] }
      groups.push(current)
    }
    current.games.push(game)
  }
  return groups
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}

// ── Expandable game item (row collapses to clean summary, expands to details) ──

function GameItem({
  game,
  onEditGame,
  onDeleteGame,
}: {
  game: Game
  onEditGame: (id: string) => void
  onDeleteGame: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div id={`game-${game.id}`}>
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        <GameRow game={game} onEdit={onEditGame} />
      </div>
      {open && (
        <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-border bg-muted/20">
          <GameDetailPanel
            game={game}
            onEdit={() => onEditGame(game.id)}
            onDelete={() => onDeleteGame(game.id)}
          />
        </div>
      )}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
  onEditGame: (id: string) => void
  scrollToGameId?: string | null
  onScrollHandled?: () => void
}

type ResultFilter = "All" | "Wins" | "Losses"
type View = "games" | "pods"

export function HistoryPage({
  games,
  onDeleteGame,
  onEditGame,
  scrollToGameId,
  onScrollHandled,
}: HistoryPageProps) {
  const [view, setView] = useState<View>("games")
  const [filter, setFilter] = useState<ResultFilter>("All")
  const [query, setQuery] = useState("")

  const podGroups = useMemo(() => buildPodGroups(games), [games])

  const matches = (g: Game) => {
    const me = g.players.find((p) => p.isMe)
    const won = !!me && g.winnerId === me.id
    if (filter === "Wins" && !won) return false
    if (filter === "Losses" && won) return false
    if (query.trim() && !me?.commanderName.toLowerCase().includes(query.trim().toLowerCase()))
      return false
    return true
  }

  const filtered = useMemo(
    () =>
      [...games]
        .filter(matches)
        .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games, filter, query]
  )

  const monthGroups = useMemo(() => groupByMonth(filtered), [filtered])

  useEffect(() => {
    if (!scrollToGameId || games.length === 0) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`game-${scrollToGameId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      onScrollHandled?.()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [scrollToGameId, games, onScrollHandled])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <div className="inline-flex rounded-md border border-input p-0.5 gap-0.5">
          {(["games", "pods"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "h-8 px-3.5 rounded-[8px] text-xs font-medium capitalize transition-colors",
                view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "games" ? (
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(["All", "Wins", "Losses"] as ResultFilter[]).map((f) => (
              <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f}
              </Chip>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by commander…"
              className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {monthGroups.length === 0 ? (
            <div className={CARD + " py-12 text-center"}>
              <div className="text-sm font-medium">No games match</div>
              <div className="mt-1 text-xs text-muted-foreground">Try a different filter or search.</div>
            </div>
          ) : (
            <>
              {monthGroups.map((m) => (
                <section key={m.key}>
                  <div className="flex items-baseline justify-between">
                    <h2 className={SECTION_LABEL}>{m.label}</h2>
                    <span className="font-mono text-[10px] text-muted-foreground tabular">
                      {m.games.length} {m.games.length === 1 ? "game" : "games"}
                    </span>
                  </div>
                  <div className={CARD + " mt-3 divide-y divide-border overflow-hidden"}>
                    {m.games.map((g) => (
                      <GameItem
                        key={g.id}
                        game={g}
                        onEditGame={onEditGame}
                        onDeleteGame={onDeleteGame}
                      />
                    ))}
                  </div>
                </section>
              ))}
              <div className="text-center font-mono text-[11px] text-muted-foreground tabular">
                showing {filtered.length} of {games.length} games
              </div>
            </>
          )}
        </>
      ) : podGroups.length === 0 ? (
        <div className={CARD + " py-12 text-center"}>
          <div className="text-sm font-medium">No pods yet</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Name all players in a game to create a pod.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {podGroups.map((pod) => (
            <section key={pod.key}>
              <div className="flex items-baseline justify-between">
                <h2 className={SECTION_LABEL + " truncate"}>{pod.label}</h2>
                <span className="font-mono text-[10px] text-muted-foreground tabular shrink-0 ml-2">
                  {pod.games.length} {pod.games.length === 1 ? "game" : "games"}
                </span>
              </div>
              <div className={CARD + " mt-3 divide-y divide-border overflow-hidden"}>
                {pod.games.map((g) => (
                  <GameItem
                    key={g.id}
                    game={g}
                    onEditGame={onEditGame}
                    onDeleteGame={onDeleteGame}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
