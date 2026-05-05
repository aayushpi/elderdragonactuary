import { Swords, FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const STORAGE_KEY = "eda_seen_live_announcement_v1"

export function hasSeenLiveAnnouncement(): boolean {
  return !!localStorage.getItem(STORAGE_KEY)
}

export function markLiveAnnouncementSeen(): void {
  localStorage.setItem(STORAGE_KEY, "1")
}

interface LiveAnnouncementModalProps {
  open: boolean
  onClose: () => void
}

export function LiveAnnouncementModal({ open, onClose }: LiveAnnouncementModalProps) {
  function handleClose() {
    markLiveAnnouncementSeen()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-sm [&>button:last-child]:hidden">
        <DialogHeader className="items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
            <Swords className="h-8 w-8 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-xl leading-tight">
              Live Game Tracking is here
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-sm">
              Track a Commander game in real time — life totals, turn timer,
              drag-to-deal damage, commander damage per player, and poison
              counters. When the game ends, your data flows straight into
              the log form.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Experimental warning */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3">
          <FlaskConical className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
            <span className="font-bold">Highly experimental.</span> The tracker
            may have bugs or unexpected behaviour. Use at your own risk — always
            double-check life totals before logging.
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          To start a tracked game, open{" "}
          <span className="font-semibold text-foreground">Log Game</span> and
          tap{" "}
          <span className="font-semibold text-foreground">Track Game Live</span>{" "}
          after selecting your players.
        </p>

        <Button className="w-full" onClick={handleClose}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  )
}
