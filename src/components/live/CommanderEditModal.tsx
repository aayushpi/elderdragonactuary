import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CommanderSearch } from "@/components/CommanderSearch"
import { resolveArtCrop } from "@/lib/scryfall"
import type { ScryfallCard } from "@/types"

interface CommanderEditModalProps {
  seatLabel: string
  commanderName: string
  displayName?: string
  onSave: (updates: { commanderName: string; commanderImageUri?: string; displayName?: string }) => void
  onCancel: () => void
}

export function CommanderEditModal({
  seatLabel,
  commanderName,
  displayName,
  onSave,
  onCancel,
}: CommanderEditModalProps) {
  const [pendingCommander, setPendingCommander] = useState(commanderName)
  const [pendingImageUri, setPendingImageUri] = useState<string | undefined>()
  const [pendingDisplayName, setPendingDisplayName] = useState(displayName ?? "")

  function handleCommanderChange(name: string, card: ScryfallCard | null) {
    setPendingCommander(name)
    setPendingImageUri(card ? resolveArtCrop(card) : undefined)
  }

  function handleSave() {
    onSave({
      commanderName: pendingCommander,
      commanderImageUri: pendingImageUri,
      displayName: pendingDisplayName.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-sm max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{seatLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Commander</p>
            <CommanderSearch value={pendingCommander} onChange={handleCommanderChange} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Display name{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <input
              type="text"
              value={pendingDisplayName}
              onChange={(e) => setPendingDisplayName(e.target.value)}
              placeholder="Player name…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
