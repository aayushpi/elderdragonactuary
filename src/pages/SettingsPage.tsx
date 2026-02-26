import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Download, Upload, Trash2, FileText, Loader2 } from "lucide-react"

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

interface SettingsPageProps {
  onImport: (json: string) => Promise<{ success: boolean; count: number; error?: string }>
  onClearAll: () => Promise<void> | void
  games: import("@/types").Game[]
}

export function SettingsPage({ onImport, onClearAll, games }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const isDevOrLocalhost = import.meta.env.DEV || window.location.hostname === "localhost"

  /** Build a backup JSON from the games already loaded in memory (from Supabase). */
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
    return JSON.stringify({ exportedAt: new Date().toISOString().slice(0, 10), games: exportGames }, null, 2)
  }

  function buildCsv(): string {
    const exportGames = JSON.parse(buildBackupJson()).games as Array<Record<string, unknown>>
    const maxPlayers = exportGames.reduce((m: number, g: Record<string, unknown>) => Math.max(m, (g.players as unknown[]).length), 0)
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
          const cmd = p.partnerName ? `${p.commanderName ?? ""} // ${p.partnerName}` : String(p.commanderName ?? "")
          row.push(csvEscape(cmd))
          const fm = p.fastMana as { hasFastMana?: boolean; cards?: string[] } | undefined
          row.push(csvEscape(fm?.hasFastMana ? (fm.cards?.join(", ") ?? "") : "No"))
          row.push(csvEscape(typeof p.knockoutTurn === "number" ? p.knockoutTurn : ""))
        } else { row.push("", "", "") }
      }
      const wi = g.winnerIndex as number
      const wp = players[wi]
      const wn = wp ? (wp.partnerName ? `${wp.commanderName ?? ""} // ${wp.partnerName}` : String(wp.commanderName ?? "")) : ""
      row.push(csvEscape(wn))
      row.push(csvEscape(g.winTurn ?? ""))
      row.push(csvEscape(g.notes ?? ""))
      row.push(csvEscape((g.winConditions as string[] | undefined)?.join(", ") ?? ""))
      row.push(csvEscape((g.keyWinconCards as string[] | undefined)?.join(", ") ?? ""))
      rows.push(row.join(","))
    })
    return rows.join("\n")
  }

  function handleExport() {
    const json = buildBackupJson()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `commando-backup-${new Date().toISOString().slice(0, 10)}.json`
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
      if (!response.ok) { toast.error("Could not load test JSON."); return }
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

  return (
    <div className="space-y-6">
      {/* Data section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Data</h2>
        <div className="rounded-lg border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Backup games</p>
              <p className="text-xs text-muted-foreground mt-0.5">Download a backup of your cloud data as JSON or CSV</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Backup JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => {
                  const csv = buildCsv()
                  const blob = new Blob([csv], { type: "text/csv" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `commando-backup-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Restore from backup</p>
              <p className="text-xs text-muted-foreground mt-0.5">Import game logs from a previously exported JSON backup</p>
              <p className="text-xs text-destructive mt-1 font-medium">Warning: this will replace all your cloud data.</p>
            </div>
            <div className="flex gap-2">
              {isDevOrLocalhost && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={handleLoadTestJson}
                  disabled={importLoading}
                >
                  {importLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Load Test JSON
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={importLoading}
              >
                {importLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Restore
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {/* Danger zone */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Board Wipe</h2>
        <div className="rounded-lg border border-destructive/30 bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Delete all data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently removes all logged games. This cannot be undone.
            </p>
          </div>
          {!confirmDelete ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete all data
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await onClearAll()
                  setConfirmDelete(false)
                  toast.success("All data deleted.")
                }}
              >
                Yes, delete everything
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
