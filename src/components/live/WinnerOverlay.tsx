import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { LivePlayer } from "@/types/live"

interface WinnerOverlayProps {
  winner: LivePlayer
  players: LivePlayer[]
  startedAt: number
  currentTurn: number
  onSave: () => void
  onSaveAndRematch: () => void
  onRematch: () => void
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function WinnerOverlay({
  winner,
  players,
  startedAt,
  currentTurn,
  onSave,
  onSaveAndRematch,
  onRematch,
}: WinnerOverlayProps) {
  const totalDurationMs = Date.now() - startedAt
  const winnerLabel = winner.displayName || winner.commanderName

  return (
    <Dialog open>
      {/* Hide the default X close button — user must choose Save or Rematch */}
      <DialogContent className="max-w-sm [&>button:last-child]:hidden">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500 flex items-center justify-center mb-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Winner</p>
          <DialogTitle className="text-2xl leading-tight">{winnerLabel}</DialogTitle>
          {winner.commanderName && winner.displayName && (
            <p className="text-sm text-muted-foreground">{winner.commanderName}</p>
          )}
        </DialogHeader>

        <Separator />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border bg-muted/50 px-3 py-2">
            <p className="text-xl font-black">{currentTurn}</p>
            <p className="text-xs text-muted-foreground">turns</p>
          </div>
          <div className="rounded-lg border bg-muted/50 px-3 py-2">
            <p className="text-xl font-black">{formatDuration(totalDurationMs)}</p>
            <p className="text-xs text-muted-foreground">duration</p>
          </div>
        </div>

        <Separator />

        {/* Final life totals */}
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Final life totals</p>
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
              <span className={`text-sm font-medium truncate mr-2 ${p.id === winner.id ? "text-yellow-600 dark:text-yellow-400" : ""}`}>
                {p.displayName || p.commanderName}
              </span>
              <span className={`text-sm font-bold tabular-nums shrink-0 ${p.isEliminated ? "text-muted-foreground" : ""}`}>
                {p.isEliminated ? `Out T${p.eliminatedOnTurn}` : p.lifeTotal}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onSave}>
              Save Game
            </Button>
            <Button className="flex-1" onClick={onSaveAndRematch}>
              Save &amp; Rematch
            </Button>
          </div>
          <Button variant="outline" className="w-full" onClick={onRematch}>
            Rematch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
