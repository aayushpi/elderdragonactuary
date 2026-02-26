import { Minus, Maximize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface GameFlowDrawerProps {
  title: string
  minimized: boolean
  onMinimize: () => void
  onRestore: () => void
  onClose: () => void
  children: React.ReactNode
}

export function GameFlowDrawer({ title, minimized, onMinimize, onRestore, onClose, children }: GameFlowDrawerProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pb-0 sm:px-4 sm:pb-0 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto mx-auto w-full rounded-t-xl rounded-b-none border bg-card shadow-lg transition-transform duration-300 sm:max-w-[min(96vw,1400px)]",
          minimized ? "translate-y-[calc(100%-3.25rem)]" : "translate-y-0"
        )}
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5 sm:px-4">
          <p className="text-sm font-semibold">{title}</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={minimized ? onRestore : onMinimize}
              aria-label={minimized ? "Restore panel" : "Minimize panel"}
              className="h-8 w-8 p-0"
            >
              {minimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close panel"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="max-h-[85vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}