import { useEffect, useState, type ReactNode } from "react"
import { Plus, Search, ArrowRight, TrendingUp } from "lucide-react"
import type { MtgColor } from "@/types"
import { Pips, ResultBadge, WrBar } from "@/components/modern/primitives"
import { LogoMark } from "@/components/modern/LogoMark"
import { cn } from "@/lib/utils"

/* ============================================================================
   In-browser recreations of the real app UI, rendered live from the actual
   design tokens (CARD/Pips/ResultBadge/WrBar). These stand in for screenshots
   so the marketing page shows exactly what the product looks like, the way
   Linear renders its product surfaces directly in the page.
   ========================================================================== */

const NAV_TABS = ["Dashboard", "Stats", "History", "Settings"]

/** macOS-style window chrome wrapping a product surface. */
export function AppFrame({
  children,
  active = "Dashboard",
  className,
}: {
  children: ReactNode
  active?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-border bg-background",
        className
      )}
    >
      {/* App top bar — mirrors the real Nav */}
      <div className="flex h-12 items-center justify-between gap-3 border-b border-border bg-[hsl(var(--background)/0.85)] px-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <span className="hidden text-[13px] font-semibold tracking-tight sm:inline">
            Elder Dragon Actuary
          </span>
        </div>
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_TABS.map((tab) => (
            <span
              key={tab}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[12.5px] font-medium",
                tab === active
                  ? "bg-raised text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {tab}
            </span>
          ))}
        </nav>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Track a game</span>
        </span>
      </div>
      {children}
    </div>
  )
}

/* ---- Hero: the dashboard ------------------------------------------------- */

const DASH_STATS: { label: string; value: string; sub: string; highlight?: boolean }[] = [
  { label: "Games", value: "142", sub: "all-time" },
  { label: "Win rate", value: "31%", sub: "44 of 142 games", highlight: true },
  { label: "Best seat", value: "1", sub: "39% 1st to play" },
  { label: "Top commander", value: "Yuriko", sub: "58% over 19 games" },
]

const DASH_GAMES: { cmdr: string; colors: MtgColor[]; vs: string; meta: string; won: boolean }[] = [
  { cmdr: "Yuriko, the Tiger's Shadow", colors: ["U", "B"], vs: "Atraxa · Krenko · Korvold", meta: "Tue, Jun 16 · seat 2 · 11 turns", won: true },
  { cmdr: "Korvold, Fae-Cursed King", colors: ["B", "R", "G"], vs: "Edgar · Sliver Overlord · Tymna", meta: "Sun, Jun 14 · seat 4 · 9 turns", won: false },
  { cmdr: "Kinnan, Bonder Prodigy", colors: ["U", "G"], vs: "Yuriko · Krenko · Atraxa", meta: "Fri, Jun 12 · seat 1 · 8 turns", won: true },
  { cmdr: "Krenko, Mob Boss", colors: ["R"], vs: "Najeela · Kenrith · Yuriko", meta: "Wed, Jun 10 · seat 3 · 7 turns", won: false },
]

export function DashboardMockup() {
  return (
    <AppFrame active="Dashboard">
      <div className="space-y-5 p-4 sm:p-5">
        {/* Search */}
        <div className="flex h-10 items-center gap-2.5 rounded-md border border-input bg-card px-3 text-[13px] text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          Search a commander to log a game…
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {DASH_STATS.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3.5">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {s.label}
              </div>
              <div
                className={cn(
                  "mt-2 truncate text-[26px] font-semibold tracking-tight tabular",
                  s.highlight && "text-primary"
                )}
              >
                {s.value}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent games */}
        <div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Recent games
            </span>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary">
              Game history <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2.5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {DASH_GAMES.map((g) => (
              <div key={g.cmdr} className="flex items-center gap-3 px-3.5 py-3">
                <div className="w-12 shrink-0">
                  <ResultBadge won={g.won} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{g.cmdr}</span>
                    <span className="hidden sm:inline-flex">
                      <Pips colors={g.colors} />
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">vs {g.vs}</div>
                </div>
                <div className="hidden shrink-0 text-right font-mono text-[10.5px] leading-4 text-muted-foreground tabular sm:block">
                  {g.meta.split(" · ").map((part, i) => (
                    <div key={i}>{part}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppFrame>
  )
}

/* ---- Live game tracking -------------------------------------------------- */

const SEATS: { cmdr: string; flip: boolean }[] = [
  { cmdr: "Atraxa · Priya", flip: true },
  { cmdr: "Yuriko · Dave", flip: true },
  { cmdr: "Krenko · Marisol", flip: false },
  { cmdr: "Korvold · You", flip: false },
]

export function LiveBoardMockup() {
  const [lives, setLives] = useState([34, 21, 40, 26])
  const [bump, setBump] = useState(0)
  const [tickIdx, setTickIdx] = useState(-1)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => {
      setLives((prev) => {
        const i = Math.floor(Math.random() * prev.length)
        const deltas = [-3, -2, -1, -1, -1, 1]
        let nv = prev[i] + deltas[Math.floor(Math.random() * deltas.length)]
        if (nv < 1) nv = 40
        if (nv > 60) nv = 60
        const next = [...prev]
        next[i] = nv
        setTickIdx(i)
        setBump((b) => b + 1)
        return next
      })
    }, 2400)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
      {SEATS.map((seat, i) => (
        <div
          key={seat.cmdr}
          className="relative flex min-h-[96px] flex-col items-center justify-center gap-1.5 bg-card p-3"
        >
          <div className={cn("flex flex-col items-center gap-1.5 text-center", seat.flip && "rotate-180")}>
            <span
              key={`${i}-${bump}`}
              className={cn(
                "text-[34px] font-bold leading-none tracking-tight tabular",
                tickIdx === i && "life-tick"
              )}
            >
              {lives[i]}
            </span>
            <span className="max-w-[26ch] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">
              {seat.cmdr}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---- Global statistics --------------------------------------------------- */

const GLOBAL_ROWS: { name: string; colors: MtgColor[]; rate: number; games: string }[] = [
  { name: "Yuriko, the Tiger's Shadow", colors: ["U", "B"], rate: 0.58, games: "1,204g" },
  { name: "Atraxa, Praetors' Voice", colors: ["W", "U", "B", "G"], rate: 0.41, games: "2,917g" },
  { name: "Krenko, Mob Boss", colors: ["R"], rate: 0.36, games: "863g" },
  { name: "Korvold, Fae-Cursed King", colors: ["B", "R", "G"], rate: 0.33, games: "1,540g" },
]

export function GlobalStatsMockup() {
  return (
    <AppFrame active="Stats">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Global win rate
          </span>
          <span className="rounded-full border border-input px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            All time
          </span>
        </div>
        <div className="space-y-3">
          {GLOBAL_ROWS.map((row) => (
            <div key={row.name} className="rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Pips colors={row.colors} />
                  <span className="truncate text-[13px] font-semibold">{row.name}</span>
                </div>
                <span className="shrink-0 font-mono text-[12px] font-semibold tabular">
                  {Math.round(row.rate * 100)}%
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <WrBar rate={row.rate} />
                <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground tabular">
                  {row.games}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  )
}

/* ---- Pod statistics ------------------------------------------------------ */

const POD_PLAYERS: { name: string; record: string; rate: number; tag?: string }[] = [
  { name: "You", record: "44–98", rate: 0.31 },
  { name: "Dave", record: "61–81", rate: 0.43, tag: "Archenemy" },
  { name: "Priya", record: "38–104", rate: 0.27 },
  { name: "Marisol", record: "29–113", rate: 0.2 },
]

export function PodStatsMockup() {
  return (
    <AppFrame active="Stats">
      <div className="p-4 sm:p-5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Pod leaderboard · 142 games
        </span>
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {POD_PLAYERS.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3 px-3.5 py-3">
              <span className="w-5 shrink-0 font-mono text-[12px] text-muted-foreground tabular">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{p.name}</span>
                  {p.tag && (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                      {p.tag}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 max-w-[150px]">
                  <WrBar rate={p.rate} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[13px] font-semibold tabular">
                  {Math.round(p.rate * 100)}%
                </div>
                <div className="font-mono text-[10.5px] text-muted-foreground tabular">{p.record}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  )
}

/* ---- Win-con evaluation -------------------------------------------------- */

const WINCONS: { name: string; resolve: number; verdict: string; keep: boolean }[] = [
  { name: "Craterhoof Behemoth", resolve: 0.71, verdict: "Wins when it lands", keep: true },
  { name: "Thassa's Oracle", resolve: 0.64, verdict: "Closes fast", keep: true },
  { name: "Expropriate", resolve: 0.38, verdict: "Slow, gets countered", keep: false },
  { name: "Torment of Hailfire", resolve: 0.22, verdict: "Rots in hand", keep: false },
]

export function WinconMockup() {
  return (
    <AppFrame active="Stats">
      <div className="p-4 sm:p-5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Win-con evaluation
        </span>
        <div className="mt-3 space-y-2.5">
          {WINCONS.map((w) => (
            <div key={w.name} className="rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px] font-semibold">{w.name}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    w.keep ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {w.keep ? <TrendingUp className="h-3 w-3" /> : null}
                  {w.keep ? "Keep" : "Cut"}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <WrBar rate={w.resolve} />
                <span className="shrink-0 font-mono text-[11px] font-semibold tabular">
                  {Math.round(w.resolve * 100)}%
                </span>
              </div>
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">{w.verdict}</div>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  )
}
