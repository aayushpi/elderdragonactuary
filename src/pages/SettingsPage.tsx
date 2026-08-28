import { useRef, useState, useEffect } from "react"
import { toast } from "sonner"
import { Download, Upload, Trash2, FileText, Loader2, LogOut, MessageSquarePlus, Megaphone, Map, HelpCircle, Compass } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { loadProfile, saveProfileDisplayName } from "@/lib/storage"
import { isFeaturebaseEnabled, featurebaseUrl } from "@/lib/featurebase"
import { capture } from "@/lib/analytics"
import { ACCENT_SWATCH, ACCENT_NAMES, type AccentName } from "@/lib/accent"
import { CARD, SECTION_LABEL } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import { copy } from "@/copy"
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

// ── Component ─────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  onImport: (json: string) => Promise<{ success: boolean; count: number; error?: string }>
  onClearAll: () => Promise<void> | void
  games: Game[]
  themeMode: "light" | "dark" | "system"
  onSetThemeMode: (mode: "light" | "dark" | "system") => void
  accent: AccentName
  onSetAccent: (accent: AccentName) => void
  userEmail?: string
  onSignOut?: () => void
  onReplayTour?: () => void
}

export function SettingsPage({
  onImport,
  onClearAll,
  games,
  themeMode,
  onSetThemeMode,
  accent,
  onSetAccent,
  userEmail,
  onSignOut,
  onReplayTour,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string>("")

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
    const headers: string[] = [copy.csv.date, copy.csv.bracket]
    for (let i = 1; i <= maxPlayers; i++) {
      headers.push(copy.csv.playerCommander(i), copy.csv.playerFastMana(i), copy.csv.playerKoTurn(i))
    }
    headers.push(copy.csv.winner, copy.csv.winTurn, copy.csv.notes, copy.csv.winConditions, copy.csv.keyWinconCards)
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
    capture("games_exported", { games_count: games.length })
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
          capture("games_imported", { games_count: result.count })
          toast.success(copy.settings.data.imported(result.count))
        } else {
          toast.error(copy.settings.data.importFailed(result.error))
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
        toast.error(copy.settings.data.testJsonUnavailable)
        return
      }
      const json = await response.text()
      const trimmed = json.trim()
      if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
        toast.error(copy.settings.data.testJsonInvalid)
        return
      }
      const result = await onImport(json)
      if (result.success) {
        toast.success(copy.settings.data.testJsonLoaded(result.count))
      } else {
        toast.error(copy.settings.data.testJsonFailed(result.error))
      }
    } catch {
      toast.error(copy.settings.data.testJsonUnavailable)
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
      <h1 className="text-xl font-semibold tracking-tight">{copy.settings.heading}</h1>

      {/* Profile */}
      <SettingsCard title={copy.settings.profile.cardTitle}>
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
              placeholder={copy.settings.profile.displayNamePlaceholder}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              saveProfileDisplayName(playerName)
              toast.success(copy.settings.profile.saved)
            }}
            className="inline-flex items-center justify-center h-9 px-4 text-sm rounded-md font-medium bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-colors"
          >
            {copy.settings.profile.save}
          </button>
          <button onClick={() => setShareOpen(true)} className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
            {copy.settings.profile.shareInvite}
          </button>
          {onSignOut && (
            <button onClick={onSignOut} className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
              <LogOut className="h-3.5 w-3.5" />
              {copy.settings.profile.signOut}
            </button>
          )}
        </div>
      </SettingsCard>

      {/* Getting started */}
      {onReplayTour && (
        <SettingsCard title={copy.settings.gettingStarted.cardTitle}>
          <SettingRow
            label={copy.settings.gettingStarted.replayLabel}
            sub={copy.settings.gettingStarted.replaySub}
          >
            <button onClick={onReplayTour} className={BTN_OUTLINE + " h-9 px-4 text-sm"}>
              <Compass className="h-3.5 w-3.5" />
              {copy.settings.gettingStarted.replayButton}
            </button>
          </SettingRow>
        </SettingsCard>
      )}

      {/* Feedback & support (Featurebase) */}
      {isFeaturebaseEnabled() && (
        <SettingsCard title={copy.settings.feedback.cardTitle}>
          <div className="flex flex-wrap items-center gap-2">
            <a href={featurebaseUrl("feedback")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"} onClick={() => capture("feedback_opened", { surface: "settings", widget: "feedback" })}>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              {copy.settings.feedback.sendFeedback}
            </a>
            <a href={featurebaseUrl("changelog")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"} onClick={() => capture("feedback_opened", { surface: "settings", widget: "changelog" })}>
              <Megaphone className="h-3.5 w-3.5" />
              {copy.settings.feedback.changelog}
            </a>
            <a href={featurebaseUrl("roadmap")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"} onClick={() => capture("feedback_opened", { surface: "settings", widget: "roadmap" })}>
              <Map className="h-3.5 w-3.5" />
              {copy.settings.feedback.roadmap}
            </a>
            <a href={featurebaseUrl("help")} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE + " h-9 px-4 text-sm"} onClick={() => capture("feedback_opened", { surface: "settings", widget: "help" })}>
              <HelpCircle className="h-3.5 w-3.5" />
              {copy.settings.feedback.helpCenter}
            </a>
          </div>
        </SettingsCard>
      )}

      {/* Appearance */}
      <SettingsCard title={copy.settings.appearance.cardTitle}>
        <div className="divide-y divide-border [&>*]:py-3.5">
          <SettingRow label={copy.settings.appearance.modeLabel} sub={copy.settings.appearance.modeSub}>
            <div className="inline-flex rounded-md border border-input p-0.5 gap-0.5">
              {(["system", "light", "dark"] as const).map((mode) => {
                const m = copy.settings.appearance.modes[mode]
                const active = themeMode === mode
                return (
                  <button
                    key={m}
                    onClick={() => {
                      capture("theme_changed", { mode })
                      onSetThemeMode(mode)
                    }}
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
          <SettingRow label={copy.settings.appearance.accentLabel} sub={copy.settings.appearance.accentSub}>
            <div className="flex items-center gap-2">
              {ACCENT_NAMES.map((name) => (
                <button
                  key={name}
                  title={name}
                  onClick={() => {
                    capture("accent_changed", { accent: name })
                    onSetAccent(name)
                  }}
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

      {/* Data */}
      <SettingsCard title={copy.settings.data.cardTitle}>
        <div className="divide-y divide-border [&>*]:py-3.5">
          <SettingRow label={copy.settings.data.exportLabel} sub={copy.settings.data.exportSub(games.length)}>
            <div className="flex gap-2">
              <button
                onClick={() => download(buildBackupJson(), "application/json", "json")}
                className={BTN_OUTLINE + " h-9 px-4 text-sm"}
              >
                <Download className="h-3.5 w-3.5" />
                {copy.settings.data.exportJson}
              </button>
              <button
                onClick={() => download(buildCsv(), "text/csv", "csv")}
                className={BTN_OUTLINE + " h-9 px-4 text-sm"}
              >
                <FileText className="h-3.5 w-3.5" />
                {copy.settings.data.exportCsv}
              </button>
            </div>
          </SettingRow>
          <SettingRow
            label={copy.settings.data.restoreLabel}
            sub={copy.settings.data.restoreSub}
          >
            <div className="flex gap-2">
              {isDevOrLocalhost && (
                <button
                  onClick={handleLoadTestJson}
                  disabled={importLoading}
                  className={BTN_OUTLINE + " h-9 px-4 text-sm"}
                >
                  {importLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {copy.settings.data.restoreTestJson}
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
                {copy.settings.data.restoreButton}
              </button>
            </div>
          </SettingRow>
          <SettingRow label={copy.settings.data.deleteLabel} sub={copy.settings.data.deleteSub}>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm rounded-md font-medium border border-rose-600/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {copy.settings.data.deleteButton}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    capture("games_cleared", { games_count: games.length })
                    await onClearAll()
                    setConfirmDelete(false)
                    toast.success(copy.settings.data.deleted)
                  }}
                  className="inline-flex items-center h-9 px-4 text-sm rounded-md font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                >
                  {copy.settings.data.deleteConfirm}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className={BTN_OUTLINE + " h-9 px-4 text-sm"}
                >
                  {copy.settings.data.deleteCancel}
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
            <h3 className="text-lg font-semibold mb-4">{copy.settings.profile.inviteTitle}</h3>
            {qrSrc ? (
              <img src={qrSrc} alt={copy.settings.profile.inviteQrAlt} className="mx-auto mb-4 w-72 h-72" />
            ) : (
              <div className="h-72 w-72 mx-auto bg-muted/30 flex items-center justify-center">
                {copy.settings.profile.inviteQrUnavailable}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
