import { Users, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { SECTION_LABEL, SHEET_CONTENT_CLASS } from "@/components/modern/primitives"

export interface PodOption {
  id: string
  label: string
  opponents: string[]
  totalPlayers: number
}

interface PodPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pods: PodOption[]
  value?: string | null
  onPick: (pod: PodOption) => void
}

export function PodPicker({ open, onOpenChange, pods, value, onPick }: PodPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_CONTENT_CLASS}>
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Pick a pod</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Reuse a group you've played with — no typing needed
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <span className={SECTION_LABEL}>Your pods</span>
          <span className="font-mono text-[11px] text-muted-foreground">tap to fill players</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
          <div className="divide-y divide-border">
            {pods.map((pod) => (
              <button
                key={pod.id}
                onClick={() => {
                  onPick(pod)
                  onOpenChange(false)
                }}
                className="group flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
              >
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold">{pod.label}</span>
                    {value === pod.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular">
                    {pod.totalPlayers} players
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
