import { useRef } from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { LivePlayer, DamageSheetState } from "@/types/live"

const LONG_PRESS_MS = 400

interface DamageSheetProps {
  sheet: DamageSheetState
  players: LivePlayer[]
  onApply: () => void
  onCancel: () => void
  onUpdateAmount: (amount: number) => void
  onUpdateType: (damageType: "regular" | "commander") => void
  onUpdateLifelink: (lifelink: boolean) => void
}

function AmountButton({
  onPress,
  onLongPress,
  children,
}: {
  onPress: () => void
  onLongPress: () => void
  children: React.ReactNode
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  function start() {
    firedRef.current = false
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }
  function end() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!firedRef.current) onPress()
  }
  function cancel() {
    if (timerRef.current) clearTimeout(timerRef.current)
    firedRef.current = true
  }

  return (
    <button
      className="w-12 h-12 rounded-full border bg-muted hover:bg-accent flex items-center justify-center active:scale-90 transition-transform select-none touch-none"
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      {children}
    </button>
  )
}

export function DamageSheet({ sheet, players, onApply, onCancel, onUpdateAmount, onUpdateType, onUpdateLifelink }: DamageSheetProps) {
  const source = players.find((p) => p.id === sheet.sourcePlayerId)
  const target = players.find((p) => p.id === sheet.targetPlayerId)

  const sourceLabel = source ? (source.displayName || source.commanderName) : "Unknown"
  const targetLabel = target ? (target.displayName || target.commanderName) : "Unknown"

  const isCommander = sheet.damageType === "commander"

  function adjust(delta: number) {
    onUpdateAmount(Math.max(1, sheet.amount + delta))
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Damage to <span className="text-destructive">{targetLabel}</span>
          </DialogTitle>
          <DialogDescription>From {sourceLabel}</DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Amount picker */}
        <div className="flex items-center justify-center gap-6 py-2">
          <AmountButton onPress={() => adjust(-1)} onLongPress={() => adjust(-5)}>
            <Minus className="h-4 w-4" />
          </AmountButton>
          <span className="text-6xl font-black tabular-nums min-w-[3ch] text-center leading-none">
            {sheet.amount}
          </span>
          <AmountButton onPress={() => adjust(1)} onLongPress={() => adjust(5)}>
            <Plus className="h-4 w-4" />
          </AmountButton>
        </div>

        <p className="text-center text-xs text-muted-foreground -mt-1">
          Hold +/− to adjust by 5
        </p>

        <Separator />

        {/* Commander damage checkbox */}
        <button
          onClick={() => onUpdateType(isCommander ? "regular" : "commander")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-colors",
            isCommander
              ? "bg-accent border-primary"
              : "bg-background border-input hover:bg-accent"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
              isCommander ? "bg-primary border-primary" : "border-muted-foreground"
            )}
          >
            {isCommander && (
              <svg viewBox="0 0 12 10" className="w-2.5 h-2.5 fill-none stroke-primary-foreground stroke-[2.5]">
                <polyline points="1,5 4,8 11,1" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Commander damage</p>
            {(() => {
              const existing = target ? (target.commanderDamageReceived[sheet.sourcePlayerId] ?? 0) : 0
              return existing > 0 ? (
                <p className="text-xs text-orange-400 font-semibold tabular-nums">
                  {existing}/21 already from {sourceLabel}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Counts toward 21-damage loss</p>
              )
            })()}
          </div>
        </button>

        {/* Lifelink checkbox */}
        <button
          onClick={() => onUpdateLifelink(!sheet.lifelink)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-colors",
            sheet.lifelink
              ? "bg-accent border-primary"
              : "bg-background border-input hover:bg-accent"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
              sheet.lifelink ? "bg-primary border-primary" : "border-muted-foreground"
            )}
          >
            {sheet.lifelink && (
              <svg viewBox="0 0 12 10" className="w-2.5 h-2.5 fill-none stroke-primary-foreground stroke-[2.5]">
                <polyline points="1,5 4,8 11,1" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Lifelink</p>
            <p className="text-xs text-muted-foreground">{sourceLabel} gains {sheet.amount} life</p>
          </div>
        </button>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={isCommander ? "default" : "destructive"}
            className="flex-1"
            onClick={onApply}
          >
            Apply −{sheet.amount}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
