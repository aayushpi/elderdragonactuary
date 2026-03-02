import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface StartLiveDialogProps {
  open: boolean
  onClose: () => void
  onSelectLayout?: (players: number) => void
}

const layouts = [2, 3, 4, 5, 6]

export default function StartLiveDialog({ open, onClose, onSelectLayout }: StartLiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start live game</DialogTitle>
          <DialogDescription>Select a player layout to begin.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {layouts.map((players) => (
            <Button
              key={players}
              variant="outline"
              onClick={() => {
                onSelectLayout?.(players)
                onClose()
              }}
            >
              {players} players
            </Button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
