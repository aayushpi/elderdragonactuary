import { useRef, useState } from "react"
import { GameHistoryRow } from "@/components/GameHistoryRow"
import { GameDetailPanel } from "@/components/GameDetailPanel"
import { Button } from "@/components/ui/button"
import { Trash2, Download, Upload } from "lucide-react"
import { exportData } from "@/lib/storage"
import type { Game } from "@/types"

interface HistoryPageProps {
  games: Game[]
  onDeleteGame: (id: string) => void
  onImport: (json: string) => { success: boolean; count: number; error?: string }
}

export function HistoryPage({ games, onDeleteGame, onImport }: HistoryPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedGame = games.find((g) => g.id === selectedId)

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
      setImportStatus(result.success ? `Imported ${result.count} game${result.count !== 1 ? "s" : ""}.` : `Import failed: ${result.error}`)
      setTimeout(() => setImportStatus(null), 4000)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {games.length} game{games.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {importStatus && (
        <p className={`text-sm px-3 py-2 rounded-md ${importStatus.startsWith("Import failed") ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700 dark:text-green-400"}`}>
          {importStatus}
        </p>
      )}

      {games.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No games yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((game) => (
            <div key={game.id} className="relative group">
              <GameHistoryRow game={game} onClick={() => setSelectedId(game.id)} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteGame(game.id)
                }}
                title="Delete game"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <GameDetailPanel
        game={selectedGame}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
