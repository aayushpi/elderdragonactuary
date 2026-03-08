import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { GameHistoryRow } from "@/components/GameHistoryRow"
import { GameDetailPanel } from "@/components/GameDetailPanel"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

import type { Game } from "@/types"

// ── Pod helpers ──────────────────────────────────────────────────────────────

/** A pod key is the sorted set of player display names. */
function podKeyForGame(game: Game): string | null {
  const names = game.players.map((p) => p.displayName?.trim()).filter(Boolean) as string[]
  if (names.length !== game.players.length || names.length === 0) return null
  return [...names].sort((a, b) => a.localeCompare(b)).join("|||")
}

interface PodGroup {
  key: string
  label: string
  players: string[] // sorted display names
  games: Game[]     // sorted newest-first
  latestDate: number
}

function buildPodGroups(games: Game[]): PodGroup[] {
  const map = new Map<string, PodGroup>()

  for (const game of games) {
    const key = podKeyForGame(game)
    if (!key) continue

    let group = map.get(key)
    if (!group) {
      const players = [...new Set(game.players.map((p) => p.displayName!.trim()))].sort((a, b) => a.localeCompare(b))
      group = {
        key,
        label: players.join(", "),
        players,
        games: [],
        latestDate: 0,
      }
      map.set(key, group)
    }
    group.games.push(game)
    const ts = new Date(game.playedAt).getTime()
    if (ts > group.latestDate) group.latestDate = ts
  }

  // Sort games within each pod (newest first), then sort pods by most recent game
  for (const group of map.values()) {
    group.games.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
  }

  return Array.from(map.values()).sort((a, b) => b.latestDate - a.latestDate)
}

// ── Month grouping helpers ───────────────────────────────────────────────────

interface MonthGroup {
  label: string   // e.g. "March 2026"
  key: string     // e.g. "2026-03"
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

// ── Component ────────────────────────────────────────────────────────────────

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
  onEditGame: (id: string) => void
  scrollToGameId?: string | null
  onScrollHandled?: () => void
}

export function HistoryPage({ games, onDeleteGame, onEditGame, scrollToGameId, onScrollHandled }: HistoryPageProps) {
  // ── Games in original order (already sorted newest-first from Supabase) ────────────
  const displayedGames = games

  const podGroups = useMemo(() => buildPodGroups(games), [games])

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
    <Tabs defaultValue="history" className="space-y-4">
      <TabsList className="w-full">
        <TabsTrigger value="history" className="flex-1">Game History</TabsTrigger>
        <TabsTrigger value="pods" className="flex-1">Pods</TabsTrigger>
      </TabsList>

      {/* ── Game History tab ─────────────────────────────────────────────── */}
      <TabsContent value="history">
        {displayedGames.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground text-sm">No games yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupByMonth(displayedGames).map(({ label, games: monthGames }) => (
              <MonthSection
                key={label}
                label={label}
                games={monthGames}
                onEditGame={onEditGame}
                onDeleteGame={onDeleteGame}
              />
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Pods tab ─────────────────────────────────────────────────────── */}
      <TabsContent value="pods">
        {podGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground text-sm">No pods yet. Name all players in a game to create a pod.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {podGroups.map((pod) => (
              <PodSection
                key={pod.key}
                pod={pod}
                onEditGame={onEditGame}
                onDeleteGame={onDeleteGame}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

// ── Pod collapsible section ──────────────────────────────────────────────────

function PodSection({
  pod,
  onEditGame,
  onDeleteGame,
}: {
  pod: PodGroup
  onEditGame: (id: string) => void
  onDeleteGame: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="text-sm font-medium truncate">{pod.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {pod.games.length} {pod.games.length === 1 ? "game" : "games"}
        </Badge>
      </button>

      {open && (
        <div className="border-t border-border space-y-2 p-2">
          {pod.games.map((game) => (
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

// ── Month collapsible section (open by default) ──────────────────────────────

function MonthSection({
  label,
  games: monthGames,
  onEditGame,
  onDeleteGame,
}: {
  label: string
  games: Game[]
  onEditGame: (id: string) => void
  onDeleteGame: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {monthGames.length} {monthGames.length === 1 ? "game" : "games"}
        </Badge>
      </button>

      {open && (
        <div className="border-t border-border space-y-2 p-2">
          {monthGames.map((game) => (
            <div id={`game-${game.id}`} key={game.id} className="rounded-lg border border-border bg-card">
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
