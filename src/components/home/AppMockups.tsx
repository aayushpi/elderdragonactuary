import { useEffect, useMemo, useRef, useState } from "react"
import {
  Plus,
  Minus,
  LogOut,
  Download,
  FileText,
  Upload,
  Trash2,
  Share2,
  Swords,
  Timer,
  Undo2,
} from "lucide-react"
import { DashboardPage } from "@/pages/DashboardPage"
import { StatsPage } from "@/pages/StatsPage"
import { HistoryPage } from "@/pages/HistoryPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { DEMO_GAMES } from "@/components/home/demoData"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import { ACCENT_SWATCH, ACCENT_NAMES, type AccentName } from "@/lib/accent"
import { cn } from "@/lib/utils"

/* ============================================================================
   A near-full-size, interactive simulation of the actual app. Dashboard, Stats
   and History render the *real* page components driven by sample data; "Track
   a game" opens the real LogGamePage; "Live game" shows a faithful recreation
   of the at-the-table live board (PR #54 UX). Settings is a read-only replica.
   ========================================================================== */

type View = "Dashboard" | "Stats" | "History" | "Settings" | "Live" | "Log"
const TABS: View[] = ["Dashboard", "Stats", "History", "Settings"]

const PATH_TO_TAB: Record<string, View> = {
  "/": "Dashboard",
  "/stats": "Stats",
  "/history": "History",
  "/settings": "Settings",
}

/* ---- Live at-the-table board (faithful to the live game mode) ------------ */

// Seat identity colours, straight from the live engine.
const SEAT_COLORS: Record<number, string> = {
  1: "#E11D2B",
  2: "#1668E3",
  3: "#15A53C",
  4: "#D97706",
}

interface LiveSeat {
  name: string
  commander: string
  seat: number
  start: number
  top: boolean
  cmdrDmg?: number
  poison?: number
}

// Grid order: top-left, top-right, bottom-left, bottom-right. The two top seats
// are rotated 180° so their text faces players across the table.
const LIVE_SEATS: LiveSeat[] = [
  { name: "Priya", commander: "Atraxa, Praetors' Voice", seat: 2, start: 31, top: true, poison: 4 },
  { name: "Dave", commander: "Edgar Markov", seat: 1, start: 24, top: true, cmdrDmg: 12 },
  { name: "Marisol", commander: "Krenko, Mob Boss", seat: 3, start: 40, top: false },
  { name: "You", commander: "Yuriko, the Tiger's Shadow", seat: 4, start: 27, top: false, cmdrDmg: 7 },
]

function useArt(name: string) {
  const [art, setArt] = useState<string | undefined>()
  useEffect(() => {
    let cancelled = false
    fetchCardByName(name)
      .then((card) => !cancelled && setArt(resolveArtCrop(card) ?? undefined))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [name])
  return art
}

function LiveSeatPanel({
  seat,
  life,
  flash,
  onSelf,
}: {
  seat: LiveSeat
  life: number
  flash: boolean
  onSelf: (delta: number) => void
}) {
  const art = useArt(seat.commander)
  const hasDamage = (seat.cmdrDmg ?? 0) > 0 || (seat.poison ?? 0) > 0

  return (
    <div
      className="relative overflow-hidden select-none text-white"
      style={{ backgroundColor: SEAT_COLORS[seat.seat] }}
    >
      {art && (
        <>
          <img src={art} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/60" />
        </>
      )}

      <div className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5", seat.top && "rotate-180")}>
        {/* attack pill near the inner edge */}
        <div className="absolute left-1/2 top-2 -translate-x-1/2">
          <span className="flex h-7 items-center gap-1 rounded-full bg-black/35 px-3 text-[10px] font-extrabold uppercase tracking-wider [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            <Swords className="h-3 w-3" /> Attack
          </span>
        </div>

        <span className="max-w-[90%] truncate text-[11px] font-bold uppercase tracking-wide text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {seat.name}
        </span>
        <span className="-mt-0.5 max-w-[92%] truncate text-[9.5px] font-medium text-white/65 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {seat.commander}
        </span>

        <div className="flex items-center gap-2.5 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => onSelf(1)}
            aria-label="lose 1 life"
            className="grid h-8 w-8 place-items-center rounded-full bg-black/25 active:scale-95"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span
            key={flash ? `f${life}` : life}
            className={cn(
              "font-black leading-none tabular-nums text-[clamp(2.2rem,7vmin,4rem)]",
              life <= 5 && "text-red-300",
              flash && "live-dmg"
            )}
          >
            {life}
          </span>
          <button
            onClick={() => onSelf(-1)}
            aria-label="gain 1 life"
            className="grid h-8 w-8 place-items-center rounded-full bg-black/25 active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {hasDamage && (
          <span className="mt-0.5 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-0.5 text-[10px] font-bold text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            {(seat.cmdrDmg ?? 0) > 0 && <span>⚔ {seat.cmdrDmg}</span>}
            {(seat.poison ?? 0) > 0 && (
              <span className={cn((seat.poison ?? 0) >= 10 ? "text-green-300" : "text-white/90")}>
                {(seat.cmdrDmg ?? 0) > 0 ? "· " : ""}☠ {seat.poison}
              </span>
            )}
            <span className="text-white/50">›</span>
          </span>
        )}
      </div>
    </div>
  )
}

function LiveBoardView({ onOpenAuth }: { onOpenAuth: (mode: "login" | "signup") => void }) {
  const [lives, setLives] = useState(LIVE_SEATS.map((s) => s.start))
  const [flashIdx, setFlashIdx] = useState(-1)
  const [turn, setTurn] = useState(4)
  const [seconds, setSeconds] = useState(132)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const dmg = window.setInterval(() => {
      setLives((prev) => {
        const i = Math.floor(Math.random() * prev.length)
        let nv = prev[i] - (1 + Math.floor(Math.random() * 4))
        if (nv < 1) nv = 40
        const next = [...prev]
        next[i] = nv
        setFlashIdx(i)
        return next
      })
    }, 2400)
    const clock = window.setInterval(() => {
      setSeconds((s) => {
        if (s >= 175) {
          setTurn((t) => t + 1)
          return 0
        }
        return s + 1
      })
    }, 1000)
    return () => {
      window.clearInterval(dmg)
      window.clearInterval(clock)
    }
  }, [])

  const adjust = (i: number, delta: number) =>
    setLives((prev) => {
      const next = [...prev]
      next[i] = Math.max(0, next[i] + delta)
      if (delta < 0) setFlashIdx(i)
      return next
    })

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[440px] overflow-hidden rounded-[22px] border border-border bg-border shadow-[0_24px_70px_hsl(240_8%_8%/0.25)] dark:shadow-[0_24px_70px_hsl(0_0%_0%/0.55)] sm:aspect-[16/11] sm:max-w-[760px]">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px">
        {LIVE_SEATS.map((seat, i) => (
          <LiveSeatPanel
            key={seat.name}
            seat={seat}
            life={lives[i]}
            flash={flashIdx === i}
            onSelf={(d) => adjust(i, d)}
          />
        ))}
      </div>

      {/* Center turn control — pinned over the seam, never rotated */}
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur">
          <button
            onClick={() => onOpenAuth("signup")}
            aria-label="Undo"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setTurn((t) => t + 1)
              setSeconds(0)
            }}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground tabular-nums"
          >
            <Timer className="h-4 w-4 opacity-80" />
            End turn · T{turn} {mmss}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---- Faithful static replica of the real Settings page ------------------- */

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 h-9 px-4 text-sm rounded-md font-medium border border-input bg-transparent text-foreground hover:bg-muted transition-colors"

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function SettingRow({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      {children}
    </div>
  )
}

function SettingsView({ onOpenAuth }: { onOpenAuth: (mode: "login" | "signup") => void }) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system")
  const [accent, setAccent] = useState<AccentName>("Orange")

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <SettingsCard title="Profile">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised font-mono text-sm font-semibold uppercase">
            YO
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <input
              value="you@pod.gg"
              disabled
              className="h-10 w-full rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
            />
            <input value="You" readOnly className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenAuth("signup")}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Save
          </button>
          <button onClick={() => onOpenAuth("signup")} className={BTN_OUTLINE}>
            <Share2 className="h-3.5 w-3.5" />
            Share invite
          </button>
          <button onClick={() => onOpenAuth("login")} className={BTN_OUTLINE}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Appearance">
        <div className="divide-y divide-border [&>*]:py-3.5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
          <SettingRow label="Mode" sub="System follows your device appearance.">
            <div className="inline-flex gap-0.5 rounded-md border border-input p-0.5">
              {(["System", "Light", "Dark"] as const).map((m) => {
                const mode = m.toLowerCase() as "system" | "light" | "dark"
                return (
                  <button
                    key={m}
                    onClick={() => setTheme(mode)}
                    className={cn(
                      "h-8 rounded-[8px] px-3.5 text-xs font-medium transition-colors",
                      theme === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </SettingRow>
          <SettingRow label="Accent" sub="Used for actions, wins, and highlights.">
            <div className="flex items-center gap-2">
              {ACCENT_NAMES.map((name) => (
                <button
                  key={name}
                  title={name}
                  onClick={() => setAccent(name)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform",
                    accent === name ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "hover:scale-110"
                  )}
                  style={{ background: ACCENT_SWATCH[name] }}
                />
              ))}
            </div>
          </SettingRow>
        </div>
      </SettingsCard>

      <SettingsCard title="Data">
        <div className="divide-y divide-border [&>*]:py-3.5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
          <SettingRow label="Export games" sub={`Download all ${DEMO_GAMES.length} games as JSON or CSV.`}>
            <div className="flex gap-2">
              <button onClick={() => onOpenAuth("signup")} className={BTN_OUTLINE}>
                <Download className="h-3.5 w-3.5" />
                JSON
              </button>
              <button onClick={() => onOpenAuth("signup")} className={BTN_OUTLINE}>
                <FileText className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
          </SettingRow>
          <SettingRow label="Restore from backup" sub="Import a previously exported JSON.">
            <button onClick={() => onOpenAuth("signup")} className={BTN_OUTLINE}>
              <Upload className="h-3.5 w-3.5" />
              Restore
            </button>
          </SettingRow>
          <SettingRow label="Delete all data" sub="Permanently removes every logged game.">
            <button
              onClick={() => onOpenAuth("signup")}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-600/30 px-4 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-600/10 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete…
            </button>
          </SettingRow>
        </div>
      </SettingsCard>
    </div>
  )
}

/* ---- The simulation shell ------------------------------------------------ */

export function AppSimulation({ onOpenAuth }: { onOpenAuth: (mode: "login" | "signup") => void }) {
  const [view, setView] = useState<View>("Dashboard")
  const logPrefill = useRef<string | undefined>(undefined)

  const navigate = (path: string) => setView(PATH_TO_TAB[path] ?? "Dashboard")
  const openLog = (commander?: string) => {
    logPrefill.current = commander
    setView("Log")
  }

  const body = useMemo(() => {
    switch (view) {
      case "Stats":
        return <StatsPage games={DEMO_GAMES} onNavigate={navigate} onOpenLogGame={openLog} />
      case "History":
        return (
          <HistoryPage
            games={DEMO_GAMES}
            onDeleteGame={() => {}}
            onEditGame={() => openLog()}
            scrollToGameId={null}
            onScrollHandled={() => {}}
          />
        )
      case "Settings":
        return <SettingsView onOpenAuth={onOpenAuth} />
      case "Live":
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Live game</h1>
              <p className="text-sm text-muted-foreground">
                One phone in the middle of the table tracks every seat.
              </p>
            </div>
            <LiveBoardView onOpenAuth={onOpenAuth} />
          </div>
        )
      case "Log":
        return (
          <div className="mx-auto max-w-2xl">
            <h1 className="mb-5 text-xl font-semibold tracking-tight">Track a game</h1>
            <LogGamePage
              prefillCommander={logPrefill.current}
              onSave={() => onOpenAuth("signup")}
              onCancel={() => setView("Dashboard")}
            />
          </div>
        )
      default:
        return (
          <DashboardPage games={DEMO_GAMES} onNavigate={navigate} onOpenLogGame={openLog} onEditGame={() => openLog()} />
        )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[16px] border border-border bg-background shadow-[0_30px_90px_hsl(240_8%_8%/0.16)] dark:shadow-[0_30px_90px_hsl(0_0%_0%/0.5)]">
      {/* App top bar — mirrors the real Nav, tabs + Live/Track buttons are live */}
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-[hsl(var(--background)/0.85)] px-3 backdrop-blur-md sm:px-4">
        <nav className="no-scrollbar -mx-1 flex items-center gap-0.5 overflow-x-auto px-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-[12.5px] font-medium transition-colors",
                t === view ? "bg-raised text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setView("Live")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-2.5 text-[12.5px] font-medium transition-colors",
              view === "Live" ? "bg-raised text-foreground" : "text-foreground hover:bg-muted"
            )}
          >
            <Swords className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Live game</span>
          </button>
          <button
            onClick={() => openLog()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Track a game</span>
          </button>
        </div>
      </div>

      {/* Body — the real pages, in the real content container */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{body}</div>
      </div>
    </div>
  )
}
