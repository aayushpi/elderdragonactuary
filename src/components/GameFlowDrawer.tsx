import { useEffect, useState } from "react"
import { Minus, Maximize2, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { copy } from "@/copy"

interface GameFlowDrawerProps {
  title: string
  minimized: boolean
  onMinimize: () => void
  onRestore: () => void
  onClose: () => void
  onDelete?: () => void
  children: React.ReactNode
}

export function GameFlowDrawer({ title, minimized, onMinimize, onRestore, onClose, onDelete, children }: GameFlowDrawerProps) {
  const [isReady, setIsReady] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="fixed inset-0 z-50 pb-0 sm:inset-x-0 sm:bottom-0 sm:px-4 sm:pb-0 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex h-full w-full flex-col rounded-none border border-t-2 bg-card shadow-lg transition-[transform,opacity] duration-300 ease-out sm:rounded-t-xl sm:max-w-[min(96vw,1400px)]",
          !isReady
            ? "translate-y-full opacity-0"
            : minimized
              ? "translate-y-[calc(100%-3.25rem-env(safe-area-inset-top))] sm:translate-y-[calc(100%-3.25rem)] opacity-100"
              : "translate-y-0 opacity-100"
        )}
      >
        {/* Header carries the safe-area inset itself (not the panel) so the
            minimized "peek" — which reveals just this row — stays sized to
            match; padding the whole panel would push the header below the
            peek window instead of shrinking to fit above it. */}
        <div
          className="flex items-center justify-between border-b px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] sm:pt-2.5 sm:px-4 cursor-pointer"
          onClick={minimized ? onRestore : onMinimize}
        >
          <p className="text-sm font-semibold">{title}</p>
          <div className="flex items-center gap-1">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation()
                  setConfirmDelete(true)
                }}
                aria-label={copy.gameFlow.deleteGameLabel}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                if (minimized) {
                  onRestore()
                  return
                }
                onMinimize()
              }}
              aria-label={minimized ? copy.gameFlow.restorePanelLabel : copy.gameFlow.minimizePanelLabel}
              className="h-8 w-8 p-0"
            >
              {minimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onClose()
              }}
              aria-label={copy.gameFlow.closePanelLabel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-h-[85vh] sm:pb-4">{children}</div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setConfirmDelete(false)}>
          <div className="w-[min(84vw,20rem)] rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-center">{copy.gameFlow.confirmDeleteTitle}</p>
            <p className="text-sm text-muted-foreground text-center">{copy.gameFlow.confirmDeleteBody}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>{copy.gameFlow.confirmDeleteCancel}</Button>
              <Button variant="destructive" className="flex-1" onClick={() => { setConfirmDelete(false); onDelete!() }}>{copy.gameFlow.confirmDeleteConfirm}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}