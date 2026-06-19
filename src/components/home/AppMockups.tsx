import { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Search,
  ArrowRight,
  ArrowUpDown,
  TrendingUp,
  Sun,
  Moon,
  Monitor,
  LogOut,
} from "lucide-react"
import type { MtgColor } from "@/types"
import { Pips, ResultBadge, WrBar } from "@/components/modern/primitives"
import { LogoMark } from "@/components/modern/LogoMark"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import { ACCENT_SWATCH, ACCENT_NAMES, type AccentName } from "@/lib/accent"
import { cn } from "@/lib/utils"

/* ============================================================================
   A near-full-size, interactive simulation of the actual app — rendered live
   from the real design tokens and primitives (Pips, ResultBadge, WrBar). The
   logged-out homepage *is* this running demo: switch tabs to walk every
   surface, the way Linear lets you drive its product directly on the page.
   ========================================================================== */

type Tab = "Dashboard" | "Stats" | "History" | "Settings"
const TABS: Tab[] = ["Dashboard", "Stats", "History", "Settings"]
const LABEL = "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"

interface SimGame {
  cmdr: string
  colors: MtgColor[]
  vs: string
  date: string
  meta: string
  won: boolean
  month: string
}

const GAMES: SimGame[] = [
  { cmdr: "Yuriko, the Tiger's Shadow", colors: ["U", "B"], vs: "Atraxa · Krenko · Korvold", date: "Tue, Jun 16", meta: "seat 2 · 11 turns", won: true, month: "June 2026" },
  { cmdr: "Korvold, Fae-Cursed King", colors: ["B", "R", "G"], vs: "Edgar · Sliver Overlord · Tymna", date: "Sun, Jun 14", meta: "seat 4 · 9 turns", won: false, month: "June 2026" },
  { cmdr: "Kinnan, Bonder Prodigy", colors: ["U", "G"], vs: "Yuriko · Krenko · Atraxa", date: "Fri, Jun 12", meta: "seat 1 · 8 turns", won: true, month: "June 2026" },
  { cmdr: "Krenko, Mob Boss", colors: ["R"], vs: "Najeela · Kenrith · Yuriko", date: "Wed, Jun 10", meta: "seat 3 · 7 turns", won: false, month: "June 2026" },
  { cmdr: "Atraxa, Praetors' Voice", colors: ["W", "U", "B", "G"], vs: "Korvold · Krenko · Kinnan", date: "Sun, Jun 7", meta: "seat 2 · 13 turns", won: false, month: "June 2026" },
  { cmdr: "Yuriko, the Tiger's Shadow", colors: ["U", "B"], vs: "Edgar · Najeela · Atraxa", date: "Sat, May 31", meta: "seat 1 · 10 turns", won: true, month: "May 2026" },
  { cmdr: "Najeela, the Blade-Blossom", colors: ["W", "U", "B", "R", "G"], vs: "Yuriko · Korvold · Kinnan", date: "Wed, May 28", meta: "seat 3 · 12 turns", won: false, month: "May 2026" },
  { cmdr: "Kenrith, the Returned King", colors: ["W", "U", "B", "R", "G"], vs: "Atraxa · Krenko · Yuriko", date: "Sun, May 24", meta: "seat 4 · 14 turns", won: false, month: "May 2026" },
]

const FAVORITES: { name: string; colors: MtgColor[]; games: number; rate: number }[] = [
  { name: "Yuriko, the Tiger's Shadow", colors: ["U", "B"], games: 19, rate: 0.58 },
  { name: "Korvold, Fae-Cursed King", colors: ["B", "R", "G"], games: 24, rate: 0.33 },
  { name: "Krenko, Mob Boss", colors: ["R"], games: 12, rate: 0.36 },
  { name: "Kinnan, Bonder Prodigy", colors: ["U", "G"], games: 9, rate: 0.44 },
  { name: "Atraxa, Praetors' Voice", colors: ["W", "U", "B", "G"], games: 16, rate: 0.41 },
]

/* ---- Shared row (mirrors the real GameRow) ------------------------------- */

function SimRow({ g }: { g: SimGame }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
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
        <div>{g.date}</div>
        <div>{g.meta}</div>
      </div>
    </div>
  )
}

/* ---- Favorite card with live Scryfall art (as in the real Dashboard) ----- */

function FavoriteCard({ fav }: { fav: (typeof FAVORITES)[number] }) {
  const [art, setArt] = useState<string | undefined>()
  useEffect(() => {
    let cancelled = false
    fetchCardByName(fav.name)
      .then((card) => !cancelled && setArt(resolveArtCrop(card) ?? undefined))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [fav.name])

  return (
    <div className="w-44 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card">
      <div className="art-ph relative grid h-24 w-full place-items-center overflow-hidden border-b border-border">
        {art ? (
          <img src={art} alt={fav.name} className="h-full w-full object-cover object-center" />
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            commander art
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-[12.5px] font-semibold" title={fav.name}>
          {fav.name.split(",")[0]}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Pips colors={fav.colors} />
          <span className="font-mono text-[10.5px] text-muted-foreground tabular">
            {fav.games}g · {Math.round(fav.rate * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---- Live board (one phone in the middle of the table) ------------------- */

const SEATS: { cmdr: string; flip: boolean }[] = [
  { cmdr: "Atraxa · Priya", flip: true },
  { cmdr: "Yuriko · Dave", flip: true },
  { cmdr: "Krenko · Marisol", flip: false },
  { cmdr: "Korvold · You", flip: false },
]

function LiveBoard() {
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
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
      {SEATS.map((seat, i) => (
        <div key={seat.cmdr} className="relative flex min-h-[84px] flex-col items-center justify-center gap-1 bg-card p-2.5">
          <div className={cn("flex flex-col items-center gap-1 text-center", seat.flip && "rotate-180")}>
            <span
              key={`${i}-${bump}`}
              className={cn("text-[30px] font-bold leading-none tracking-tight tabular", tickIdx === i && "life-tick")}
            >
              {lives[i]}
            </span>
            <span className="max-w-[24ch] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] text-muted-foreground">
              {seat.cmdr}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---- Dashboard view ------------------------------------------------------ */

const DASH_STATS: { label: string; value: string; sub: string; highlight?: boolean }[] = [
  { label: "Games", value: "142", sub: "all-time" },
  { label: "Win rate", value: "31%", sub: "44 of 142 games", highlight: true },
  { label: "Best seat", value: "1", sub: "39% 1st to play" },
  { label: "Top commander", value: "Yuriko", sub: "58% over 19 games" },
]

function DashboardView() {
  return (
    <div className="space-y-6">
      <div className="flex h-10 items-center gap-2.5 rounded-md border border-input bg-card px-3 text-[13px] text-muted-foreground">
        <Search className="h-4 w-4 shrink-0" />
        Search a commander to log a game…
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {DASH_STATS.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3.5">
            <div className={LABEL}>{s.label}</div>
            <div className={cn("mt-2 truncate text-[26px] font-semibold tracking-tight tabular", s.highlight && "text-primary")}>
              {s.value}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <span className={LABEL}>Live game · turn 7</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            In progress
          </span>
        </div>
        <LiveBoard />
      </section>

      <section>
        <h2 className={LABEL}>Favorite commanders</h2>
        <div className="no-scrollbar mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto">
          {FAVORITES.map((f) => (
            <FavoriteCard key={f.name} fav={f} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className={LABEL}>Recent games</h2>
          <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary">
            Game history <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-2.5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {GAMES.slice(0, 5).map((g) => (
            <SimRow key={g.cmdr + g.date} g={g} />
          ))}
        </div>
      </section>
    </div>
  )
}

/* ---- Stats view ---------------------------------------------------------- */

const GLOBAL_ROWS: { name: string; colors: MtgColor[]; rate: number; games: string }[] = [
  { name: "Yuriko, the Tiger's Shadow", colors: ["U", "B"], rate: 0.58, games: "1,204g" },
  { name: "Atraxa, Praetors' Voice", colors: ["W", "U", "B", "G"], rate: 0.41, games: "2,917g" },
  { name: "Krenko, Mob Boss", colors: ["R"], rate: 0.36, games: "863g" },
  { name: "Korvold, Fae-Cursed King", colors: ["B", "R", "G"], rate: 0.33, games: "1,540g" },
]

const POD_PLAYERS: { name: string; record: string; rate: number; tag?: string }[] = [
  { name: "Dave", record: "61–81", rate: 0.43, tag: "Archenemy" },
  { name: "You", record: "44–98", rate: 0.31 },
  { name: "Priya", record: "38–104", rate: 0.27 },
  { name: "Marisol", record: "29–113", rate: 0.2 },
]

const WINCONS: { name: string; resolve: number; verdict: string; keep: boolean }[] = [
  { name: "Craterhoof Behemoth", resolve: 0.71, verdict: "Wins when it lands", keep: true },
  { name: "Thassa's Oracle", resolve: 0.64, verdict: "Closes fast", keep: true },
  { name: "Expropriate", resolve: 0.38, verdict: "Slow, gets countered", keep: false },
  { name: "Torment of Hailfire", resolve: 0.22, verdict: "Rots in hand", keep: false },
]

function StatsView() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <span className={LABEL}>Global win rate</span>
            <span className="rounded-full border border-input px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">All time</span>
          </div>
          <div className="space-y-2.5">
            {GLOBAL_ROWS.map((row) => (
              <div key={row.name} className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Pips colors={row.colors} />
                    <span className="truncate text-[13px] font-semibold">{row.name}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[12px] font-semibold tabular">{Math.round(row.rate * 100)}%</span>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <WrBar rate={row.rate} />
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground tabular">{row.games}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <span className={LABEL}>Pod leaderboard · 142 games</span>
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {POD_PLAYERS.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 px-3.5 py-3">
                <span className="w-5 shrink-0 font-mono text-[12px] text-muted-foreground tabular">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{p.name}</span>
                    {p.tag && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">{p.tag}</span>
                    )}
                  </div>
                  <div className="mt-1.5 max-w-[150px]">
                    <WrBar rate={p.rate} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[13px] font-semibold tabular">{Math.round(p.rate * 100)}%</div>
                  <div className="font-mono text-[10.5px] text-muted-foreground tabular">{p.record}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <span className={LABEL}>Win-con evaluation</span>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                <span className="shrink-0 font-mono text-[11px] font-semibold tabular">{Math.round(w.resolve * 100)}%</span>
              </div>
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">{w.verdict}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ---- History view -------------------------------------------------------- */

function HistoryView() {
  const [filter, setFilter] = useState<"All" | "Wins" | "Losses">("All")
  const shown = GAMES.filter((g) => (filter === "All" ? true : filter === "Wins" ? g.won : !g.won))
  const months = [...new Set(shown.map((g) => g.month))]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">History</h1>
        <div className="inline-flex gap-0.5 rounded-md border border-input p-0.5">
          {(["games", "pods"] as const).map((v, i) => (
            <span
              key={v}
              className={cn(
                "h-7 rounded-[7px] px-3 text-[11.5px] font-medium capitalize leading-7",
                i === 0 ? "bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {(["All", "Wins", "Losses"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-7 rounded-full px-3 text-[11.5px] font-medium transition-colors",
              filter === f ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex h-10 items-center gap-2.5 rounded-md border border-input bg-card px-3 text-[13px] text-muted-foreground">
        <Search className="h-4 w-4 shrink-0" />
        Filter by commander…
      </div>

      {months.map((m) => {
        const games = shown.filter((g) => g.month === m)
        return (
          <section key={m}>
            <div className="flex items-baseline justify-between">
              <h2 className={LABEL}>{m}</h2>
              <span className="font-mono text-[10px] text-muted-foreground tabular">
                {games.length} {games.length === 1 ? "game" : "games"}
              </span>
            </div>
            <div className="mt-2.5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {games.map((g) => (
                <SimRow key={g.cmdr + g.date} g={g} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ---- Settings view ------------------------------------------------------- */

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  )
}

function SettingsView() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [accent, setAccent] = useState<AccentName>("Orange")

  return (
    <div className="mx-auto max-w-[620px] space-y-5">
      <SettingsCard title="Profile">
        <div>
          <div className="text-[12.5px] font-medium">Display name</div>
          <div className="mt-1.5 flex h-10 items-center rounded-md border border-input bg-background px-3 text-[13px]">You</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground">Save</span>
          <span className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-4 text-[13px] font-medium text-muted-foreground">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </span>
        </div>
      </SettingsCard>

      <SettingsCard title="Appearance">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12.5px] font-medium">Theme</div>
            <div className="text-[11.5px] text-muted-foreground">Light, dark, or follow your system.</div>
          </div>
          <div className="inline-flex gap-0.5 rounded-md border border-input p-0.5">
            {([["light", Sun], ["dark", Moon], ["system", Monitor]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={cn(
                  "grid h-8 w-9 place-items-center rounded-[7px] transition-colors",
                  theme === mode ? "bg-raised text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={mode}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12.5px] font-medium">Accent</div>
            <div className="text-[11.5px] text-muted-foreground">Used for actions, wins, and highlights.</div>
          </div>
          <div className="flex items-center gap-2">
            {ACCENT_NAMES.map((name) => (
              <button
                key={name}
                onClick={() => setAccent(name)}
                aria-label={name}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform",
                  accent === name ? "scale-110 border-foreground" : "border-transparent"
                )}
                style={{ background: ACCENT_SWATCH[name] }}
              />
            ))}
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

/* ---- The simulation shell ------------------------------------------------ */

export function AppSimulation({ onOpenAuth }: { onOpenAuth: (mode: "login" | "signup") => void }) {
  const [tab, setTab] = useState<Tab>("Dashboard")
  const view = useMemo(() => {
    switch (tab) {
      case "Stats":
        return <StatsView />
      case "History":
        return <HistoryView />
      case "Settings":
        return <SettingsView />
      default:
        return <DashboardView />
    }
  }, [tab])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[16px] border border-border bg-background shadow-[0_30px_90px_hsl(240_8%_8%/0.16)] dark:shadow-[0_30px_90px_hsl(0_0%_0%/0.5)]">
      {/* App top bar — mirrors the real Nav, tabs are live */}
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-[hsl(var(--background)/0.85)] px-3 backdrop-blur-md sm:px-4">
        <div className="flex items-center gap-2.5">
          <LogoMark size={24} />
          <span className="hidden text-[14px] font-semibold tracking-tight sm:inline">Elder Dragon Actuary</span>
        </div>
        <nav className="no-scrollbar -mx-1 flex items-center gap-0.5 overflow-x-auto px-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-[12.5px] font-medium transition-colors",
                t === tab ? "bg-raised text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </nav>
        <button
          onClick={() => onOpenAuth("signup")}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Track a game</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-[920px]">{view}</div>
      </div>
    </div>
  )
}
