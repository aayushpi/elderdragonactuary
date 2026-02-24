import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Download, Upload, Trash2 } from "lucide-react"
import { exportData, exportCSV } from "@/lib/storage"

interface SettingsPageProps {
  onImport: (json: string) => { success: boolean; count: number; error?: string }
  onClearAll: () => void
}

export function SettingsPage({ onImport, onClearAll }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleExport() {
    const json = exportData()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `commando-games-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const json = ev.target?.result as string
      const result = onImport(json)
      if (result.success) {
        toast.success(`Imported ${result.count} game${result.count !== 1 ? "s" : ""}.`)
      } else {
        toast.error(`Import failed: ${result.error}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Data section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Data</h2>
        <div className="rounded-lg border bg-card divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Export games</p>
              <p className="text-xs text-muted-foreground mt-0.5">Download all games as JSON or CSV (game log only)</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => {
                  const csv = exportCSV()
                  const blob = new Blob([csv], { type: "text/csv" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `commando-games-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Import games</p>
              <p className="text-xs text-muted-foreground mt-0.5">Replace all games from a JSON export file</p>
              <p className="text-xs text-destructive mt-1 font-medium">Warning: this will erase your current data.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Danger zone</h2>
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
                onClick={() => {
                  onClearAll()
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
