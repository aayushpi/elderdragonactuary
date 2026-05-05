import { useState, useMemo } from "react"
import { ChevronUp, ChevronDown, Loader2, ShieldAlert } from "lucide-react"
import { useAdminData, type AdminPlayer, type AdminGame } from "@/hooks/useAdminData"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function fmtEmail(email: string): string {
  return email.length > 28 ? email.slice(0, 26) + "…" : email
}

type SortDir = "asc" | "desc"

function useSortable<T>(
  items: T[],
  defaultKey: keyof T,
  defaultDir: SortDir = "desc",
) {
  const [key, setKey]  = useState<keyof T>(defaultKey)
  const [dir, setDir]  = useState<SortDir>(defaultDir)

  function toggle(k: keyof T) {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setKey(k); setDir("desc") }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = a[key]; const bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return dir === "asc" ? cmp : -cmp
    })
  }, [items, key, dir])

  return { sorted, sortKey: key, sortDir: dir, toggle }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortTh<T>({
  label, sortKey, active, dir, onToggle, className,
}: {
  label: string
  sortKey: keyof T
  active: boolean
  dir: SortDir
  onToggle: (k: keyof T) => void
  className?: string
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${className ?? ""}`}
      onClick={() => onToggle(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? dir === "asc"
            ? <ChevronUp className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />
          : <span className="h-3 w-3 opacity-30"><ChevronDown className="h-3 w-3" /></span>
        }
      </span>
    </th>
  )
}

// ─── Players table ────────────────────────────────────────────────────────────

type PlayerSortKey = keyof Pick<AdminPlayer, "email" | "games_logged" | "last_game_at" | "first_game_at">

function PlayersSection({ players }: { players: AdminPlayer[] }) {
  const [query, setQuery] = useState("")
  const { sorted, sortKey, sortDir, toggle } = useSortable<AdminPlayer>(players, "games_logged")

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return sorted.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        (p.commanders_played ?? []).some((c) => c.toLowerCase().includes(q)),
    )
  }, [sorted, query])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Players <span className="text-foreground font-bold text-base normal-case tracking-normal">{players.length}</span>
        </h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by email or commander…"
          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-56 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="border border-border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <SortTh<AdminPlayer> label="Email"      sortKey="email"          active={sortKey === "email"}          dir={sortDir} onToggle={toggle as (k: PlayerSortKey) => void} />
              <SortTh<AdminPlayer> label="Games"      sortKey="games_logged"   active={sortKey === "games_logged"}   dir={sortDir} onToggle={toggle as (k: PlayerSortKey) => void} />
              <SortTh<AdminPlayer> label="First Game" sortKey="first_game_at"  active={sortKey === "first_game_at"}  dir={sortDir} onToggle={toggle as (k: PlayerSortKey) => void} />
              <SortTh<AdminPlayer> label="Last Game"  sortKey="last_game_at"   active={sortKey === "last_game_at"}   dir={sortDir} onToggle={toggle as (k: PlayerSortKey) => void} />
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commanders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">No players match this filter.</td>
              </tr>
            ) : filtered.map((p) => (
              <tr key={p.user_id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 font-mono text-xs" title={p.email}>{fmtEmail(p.email)}</td>
                <td className="px-3 py-2 font-bold tabular-nums">{p.games_logged}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.first_game_at)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.last_game_at)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[220px] truncate" title={(p.commanders_played ?? []).join(", ")}>
                  {(p.commanders_played ?? []).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Games table ──────────────────────────────────────────────────────────────

type GameSortKey = keyof Pick<AdminGame, "played_at" | "user_email" | "bracket" | "win_turn">

function GamesSection({ games }: { games: AdminGame[] }) {
  const [query, setQuery] = useState("")
  const { sorted, sortKey, sortDir, toggle } = useSortable<AdminGame>(games, "played_at")

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return sorted.filter(
      (g) =>
        g.user_email.toLowerCase().includes(q) ||
        g.players.some(
          (p) =>
            p.commanderName.toLowerCase().includes(q) ||
            (p.displayName ?? "").toLowerCase().includes(q),
        ) ||
        (g.win_conditions ?? []).some((c) => c.toLowerCase().includes(q)) ||
        (g.notes ?? "").toLowerCase().includes(q),
    )
  }, [sorted, query])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Games <span className="text-foreground font-bold text-base normal-case tracking-normal">{games.length}</span>
        </h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by user, commander, win con…"
          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground w-64 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="border border-border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <SortTh<AdminGame> label="Date"     sortKey="played_at"   active={sortKey === "played_at"}  dir={sortDir} onToggle={toggle as (k: GameSortKey) => void} />
              <SortTh<AdminGame> label="User"     sortKey="user_email"  active={sortKey === "user_email"} dir={sortDir} onToggle={toggle as (k: GameSortKey) => void} />
              <SortTh<AdminGame> label="Br"       sortKey="bracket"     active={sortKey === "bracket"}    dir={sortDir} onToggle={toggle as (k: GameSortKey) => void} className="w-12" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Players</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Winner</th>
              <SortTh<AdminGame> label="Turn"     sortKey="win_turn"    active={sortKey === "win_turn"}   dir={sortDir} onToggle={toggle as (k: GameSortKey) => void} className="w-14" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Win Conditions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">No games match this filter.</td>
              </tr>
            ) : filtered.map((g) => {
              const winner = g.players.find((p) => p.id === g.winner_player_id)
              const winnerLabel = winner?.displayName
                ? `${winner.displayName} (${winner.commanderName})`
                : winner?.commanderName ?? "—"
              const playerList = g.players
                .map((p) => p.displayName ? `${p.displayName} – ${p.commanderName}` : p.commanderName)
                .join(", ")

              return (
                <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(g.played_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs" title={g.user_email}>{fmtEmail(g.user_email)}</td>
                  <td className="px-3 py-2 text-xs text-center">{g.bracket ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[220px] truncate" title={playerList}>{playerList}</td>
                  <td className="px-3 py-2 text-xs font-medium max-w-[160px] truncate" title={winnerLabel}>{winnerLabel}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-center">{g.win_turn}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate" title={(g.win_conditions ?? []).join(", ")}>
                    {(g.win_conditions ?? []).join(", ") || "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { players, games, loading, unauthorized, error } = useAdminData()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p className="text-sm font-semibold">Unauthorized</p>
        <p className="text-xs text-muted-foreground">Your account is not in the admin_users table.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">God Mode</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {players.length} player{players.length !== 1 ? "s" : ""} · {games.length} game{games.length !== 1 ? "s" : ""} total
        </p>
      </div>

      <PlayersSection players={players} />
      <GamesSection games={games} />
    </div>
  )
}
