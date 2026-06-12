import { useRef, useState, useEffect } from "react"
import { toast } from "sonner"
import { Download, Upload, Trash2, FileText, Loader2, LogOut, MessageSquarePlus, Megaphone, Map, HelpCircle } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { loadProfile, saveProfileDisplayName } from "@/lib/storage"
import { isFeaturebaseEnabled, featurebaseUrl } from "@/lib/featurebase"
import { ACCENT_SWATCH, ACCENT_NAMES, type AccentName } from "@/lib/accent"
import { CARD, SECTION_LABEL } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium border border-input bg-transparent text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

// ── Layout primitives (Modern UI) ─────────────────────────────────────────────

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={CARD + " overflow-hidden"}>
      <div className="px-4 sm:px-5 py-3.5 border-b border-border">
        <div className={SECTION_LABEL}>{title}</div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  sub,
  children,
}: {
  label: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-input overflow-hidden">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="h-9 w-9 grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base"
      >
        −
      </button>
      <span className="w-12 text-center font-mono text-sm font-medium tabular border-x border-input leading-9">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="h-9 w-9 grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base"
      >
        +
      </button>
    </div>
  )
}

// ── Game-default persistence ──────────────────────────────────────────────────

function loadNum(key: string, fallback: number): number {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : fallback
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  onImport: (json: string) => Promise<{ success: boolean; count: number; error?: string }>
  onClearAll: () => Promise<void> | void
  games: Game[]
  resolvedTheme: "light" | "dark"
  onSetDark: (dark: boolean) => void
  accent: AccentName
  onSetAccent: (accent: AccentName) => void
  userEmail?: string
  onSignOut?: () => void
}

export function SettingsPage({
  onImport,
  onClearAll,
  games,
  resolvedTheme,
  onSetDark,
  accent,
  onSetAccent,
  userEmail,
  onSignOut,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string>("")
  const [life, setLife] = useState(() => loadNum("default-life", 40))
  const [pod, setPod] = useState(() => loadNum("default-pod", 4))

  useEffect(() => {
    setPlayerName(loadProfile().displayName ?? "")
  }, [])

  useEffect(() => {
    function onProfileUpdate() {
      setPlayerName(loadProfile().displayName ?? "")
    }
    window.addEventListener("profile:updated", onProfileUpdate)
    return () => window.removeEventListener("profile:updated", onProfileUpdate)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("default-life", String(life))
    } catch {
      void 0
    }
  }, [life])

  useEffect(() => {
    try {
      localStorage.setItem("default-pod", String(pod))
    } catch {
      void 0
    }
  }, [pod])

  const isDevOrLocalhost = import.meta.env.DEV || window.location.hostname === "localhost"

  const initials = (playerName || userEmail || "yg").slice(0, 2).toLowerCase()

  function buildBackupJson(): string {
    const exportGames = games.map((g) => {
      const winnerIndex = g.players.findIndex((p) => p.id === g.winnerId)
      return {
        playedAt: g.playedAt.slice(0, 10),
        winTurn: g.winTurn,
        winnerIndex: winnerIndex >= 0 ? winnerIndex : 0,
        notes: g.notes,
        winConditions: g.winConditions,
        keyWinconCards: g.keyWinconCards,
        bracket: g.bracket,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        players: g.players.map(({ id: _id, isMe: _isMe, ...rest }) => rest),
      }
    })
    return JSON.stringify(
      { exportedAt: new Date().toISOString().slice(0, 10), games: exportGames },
      null,
      2
    )
  }

  function buildCsv(): string {
    const exportGames = JSON.parse(buildBackupJson()).games as Array<Record<string, unknown>>
    const maxPlayers = exportGames.reduce(
      (m: number, g: Record<string, unknown>) => Math.max(m, (g.players as unknown[]).length),
      0
    )
    const headers: string[] = ["Date", "Bracket"]
    for (let i = 1; i <= maxPlayers; i++) {
      headers.push(`Player ${i} Commander`, `Player ${i} Fast Mana`, `Player ${i} KO Turn`)
    }
    headers.push("Winner", "Win Turn", "Notes", "Win Conditions", "Key Wincon Cards")
    const rows: string[] = [headers.join(",")]
    exportGames.forEach((g) => {
      const row: string[] = []
      row.push(String(g.playedAt ?? ""))
      row.push(g.bracket ? String(g.bracket) : "")
      const players = g.players as Array<Record<string, unknown>>
      for (let i = 0; i < maxPlayers; i++) {
        const p = players[i]
        if (p) {
          const cmd = p.partnerName
            ? `${p.commanderName ?? ""} // ${p.partnerName}`
            : String(p.commanderName ?? "")
          row.push(csvEscape(cmd))
          const fm = p.fastMana as { hasFastMana?: boolean; cards?: string[] } | undefined
          row.push(csvEscape(fm?.hasFastMana ? fm.cards?.join(", ") ?? "" : "No"))
          row.push(csvEscape(typeof p.knockoutTurn === "number" ? p.knockoutTurn : ""))
        } else {
          row.push("", "", "")
        }
      }
      const wi = g.winnerIndex as number
      const wp = players[wi]
      const wn = wp
        ? wp.partnerName
          ? `${wp.commanderName ?? ""} // ${wp.partnerName}`
          : String(wp.commanderName ?? "")
        : ""
      row.push(csvEscape(wn))
      row.push(csvEscape(g.winTurn ?? ""))
      row.push(csvEscape(g.notes ?? ""))
      row.push(csvEscape((g.winConditions as string[] | undefined)?.join(", ") ?? ""))
      row.push(csvEscape((g.keyWinconCards as string[] | undefined)?.join(", ") ?? ""))
      rows.push(row.join(","))
    })
    return rows.join("\n")
  }

  function download(content: string, mime: string, ext: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `commando-backup-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const json = ev.target?.result as string
      try {
        const result = await onImport(json)
        if (result.success) {
          toast.success(`Imported ${result.count} game${result.count !== 1 ? "s" : ""}.`)
        } else {
          toast.error(`Import failed: ${result.error}`)
        }
      } finally {
        setImportLoading(false)
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  async function handleLoadTestJson() {
    try {
      setImportLoading(true)
      const response = await fetch("/load-test-games.json")
      if (!response.ok) {
        toast.error("Could not load test JSON.")
        return
      }
      const json = await response.text()
      const trimmed = json.trim()
      if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
        toast.error("Load test JSON file was not found or is not valid JSON.")
        return
      }
      const result = await onImport(json)
      if (result.success) {
        toast.success(`Loaded test JSON with ${result.count} game${result.count !== 1 ? "s" : ""}.`)
      } else {
        toast.error(`Load test JSON failed: ${result.error}`)
      }
    } catch {
      toast.error("Could not load test JSON.")
    } finally {
      setImportLoading(false)
    }
  }

  useEffect(() => {
    if (!shareOpen) return
    try {
      const signupUrl = `${window.location.origin}/auth?mode=signup&invite=${encodeURIComponent("BOLT THE BIRD")}`
      setQrSrc(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(signupUrl)}`)
    } catch {
      setQrSrc(null)
    }
  }, [shareOpen])

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {/* Profile */}
      <SettingsCard title="Profile">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised font-mono text-sm font-semibold uppercase">
            {initials}
          </span>
          <div className="min-w-0 flex-1 grid gap-2">
            <input
              value={userEmail ?? ""}
              disabled
              className="h-10 w-full rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
            />
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Display name"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              saveProfileDisplayName(playerName)
              toast.success("Display name saved")
            }}
            className="inline-flex items-center justify-center h-9 px-4 text-sm rounded-md font-medium bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-colors"
          >
            Save
          </button>
          <button onClick={() => setShareOpen(true)} className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
            Share invite
          </button>
          {onSignOut && (
            <button onClick={onSignOut} className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          )}
        </div>
      </SettingsCard>

      {/* Feedback & support (Featurebase) */}
      {isFeaturebaseEnabled() && (
        <SettingsCard title="Feedback & support">
          <div className="flex flex-wrap items-center gap-2">
            <a href={featurebaseUrl("feedback")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Send feedback
            </a>
            <a href={featurebaseUrl("changelog")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
              <Megaphone className="h-3.5 w-3.5" />
              What's new
            </a>
            <a href={featurebaseUrl("roadmap")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
              <Map className="h-3.5 w-3.5" />
              Roadmap
            </a>
            <a href={featurebaseUrl("help")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
              <HelpCircle className="h-3.5 w-3.5" />
              Help center
            </a>
          </div>
        </SettingsCard>
      )}

      {/* Appearance */}
      <SettingsCard title="Appearance">
        <div className="divide-y divide-border [&>*]:py-3.5">
          <SettingRow label="Mode" sub="Switch between dark and light theme.">
            <div className="inline-flex rounded-md border border-input p-0.5 gap-0.5">
              {(["Dark", "Light"] as const).map((m) => {
                const active = (resolvedTheme === "dark" ? "Dark" : "Light") === m
                return (
                  <button
                    key={m}
                    onClick={() => onSetDark(m === "Dark")}
                    className={cn(
                      "h-8 px-3.5 rounded-[8px] text-xs font-medium transition-colors",
                      active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
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
                  onClick={() => onSetAccent(name)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform",
                    accent === name
                      ? "ring-2 ring-offset-2 ring-ring ring-offset-background"
                      : "hover:scale-110"
                  )}
                  style={{ background: ACCENT_SWATCH[name] }}
                />
              ))}
            </div>
          </SettingRow>
        </div>
      </SettingsCard>

      {/* Game defaults */}
      <SettingsCard title="Game defaults">
        <div className="divide-y divide-border [&>*]:py-3.5">
          <SettingRow label="Starting life" sub="Commander default is 40.">
            <Stepper value={life} onChange={setLife} min={20} max={60} step={5} />
          </SettingRow>
          <SettingRow label="Default pod size" sub="Pre-filled when you track a game.">
            <Stepper value={pod} onChange={setPod} min={2} max={6} />
          </SettingRow>
        </div>
      </SettingsCard>

      {/* Data */}
      <SettingsCard title="Data">
        <div className="divide-y divide-border [&>*]:py-3.5">
          <SettingRow label="Export games" sub={`Download all ${games.length} games as JSON or CSV.`}>
            <div className="flex gap-2">
              <button
                onClick={() => download(buildBackupJson(), "application/json", "json")}
                className={BTN_OUTLINE + " h-9 px-4 text-sm"}
              >
                <Download className="h-3.5 w-3.5" />
                JSON
              </button>
              <button
                onClick={() => download(buildCsv(), "text/csv", "csv")}
                className={BTN_OUTLINE + " h-9 px-4 text-sm"}
              >
                <FileText className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
          </SettingRow>
          <SettingRow
            label="Restore from backup"
            sub="Import a previously exported JSON. Replaces all cloud data."
          >
            <div className="flex gap-2">
              {isDevOrLocalhost && (
                <button
                  onClick={handleLoadTestJson}
                  disabled={importLoading}
                  className={BTN_OUTLINE + " h-9 px-4 text-sm"}
                >
                  {importLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Test JSON
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importLoading}
                className={BTN_OUTLINE + " h-9 px-4 text-sm"}
              >
                {importLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Restore
              </button>
            </div>
          </SettingRow>
          <SettingRow label="Delete all data" sub="Permanently removes every logged game.">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm rounded-md font-medium border border-rose-600/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete…
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await onClearAll()
                    setConfirmDelete(false)
                    toast.success("All data deleted.")
                  }}
                  className="inline-flex items-center h-9 px-4 text-sm rounded-md font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className={BTN_OUTLINE + " h-9 px-4 text-sm"}
                >
                  Cancel
                </button>
              </div>
            )}
          </SettingRow>
        </div>
      </SettingsCard>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-sm">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Invite someone!</h3>
            {qrSrc ? (
              <img src={qrSrc} alt="Invite QR code" className="mx-auto mb-4 w-72 h-72" />
            ) : (
              <div className="h-72 w-72 mx-auto bg-muted/30 flex items-center justify-center">
                QR unavailable
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
