import { useMemo, useState } from "react"
import { Plus, LogOut, Download, FileText, Upload, Trash2, Share2 } from "lucide-react"
import { DashboardPage } from "@/pages/DashboardPage"
import { StatsPage } from "@/pages/StatsPage"
import { HistoryPage } from "@/pages/HistoryPage"
import { DEMO_GAMES } from "@/components/home/demoData"
import { ACCENT_SWATCH, ACCENT_NAMES, type AccentName } from "@/lib/accent"
import { cn } from "@/lib/utils"

/* ============================================================================
   A near-full-size, interactive simulation of the actual app. The Dashboard,
   Stats and History tabs render the *real* page components driven by sample
   data (see demoData), so the logged-out homepage shows exactly what the
   product looks like in use. Settings is a faithful read-only replica (the
   live one mutates stored data). Linear-style: drive the product on the page.
   ========================================================================== */

type Tab = "Dashboard" | "Stats" | "History" | "Settings"
const TABS: Tab[] = ["Dashboard", "Stats", "History", "Settings"]

const PATH_TO_TAB: Record<string, Tab> = {
  "/": "Dashboard",
  "/stats": "Stats",
  "/history": "History",
  "/settings": "Settings",
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
            <input
              value="You"
              readOnly
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            />
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
  const [tab, setTab] = useState<Tab>("Dashboard")
  const toAuth = () => onOpenAuth("signup")
  const navigate = (path: string) => setTab(PATH_TO_TAB[path] ?? "Dashboard")

  const view = useMemo(() => {
    switch (tab) {
      case "Stats":
        return <StatsPage games={DEMO_GAMES} onNavigate={navigate} onOpenLogGame={toAuth} />
      case "History":
        return (
          <HistoryPage
            games={DEMO_GAMES}
            onDeleteGame={toAuth}
            onEditGame={toAuth}
            scrollToGameId={null}
            onScrollHandled={() => {}}
          />
        )
      case "Settings":
        return <SettingsView onOpenAuth={onOpenAuth} />
      default:
        return (
          <DashboardPage
            games={DEMO_GAMES}
            onNavigate={navigate}
            onOpenLogGame={toAuth}
            onEditGame={toAuth}
          />
        )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[16px] border border-border bg-background shadow-[0_30px_90px_hsl(240_8%_8%/0.16)] dark:shadow-[0_30px_90px_hsl(0_0%_0%/0.5)]">
      {/* App top bar — mirrors the real Nav, tabs are live */}
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-[hsl(var(--background)/0.85)] px-3 backdrop-blur-md sm:px-4">
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
          onClick={toAuth}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Track a game</span>
        </button>
      </div>

      {/* Body — the real pages, in the real content container */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{view}</div>
      </div>
    </div>
  )
}
