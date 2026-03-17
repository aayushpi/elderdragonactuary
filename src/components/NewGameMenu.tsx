import type { ReactNode } from "react"
import { useState } from "react"
import { RadioTower, Play, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface NewGameMenuProps {
  trigger: ReactNode
  hasLiveGame?: boolean
  prefillCommander?: string
  onQuickLog: (commanderName?: string) => void
  onStartLiveGame: (commanderName?: string) => void
  onResumeLiveGame: () => void
}

export function NewGameMenu({
  trigger,
  hasLiveGame = false,
  prefillCommander,
  onQuickLog,
  onStartLiveGame,
  onResumeLiveGame,
}: NewGameMenuProps) {
  const [open, setOpen] = useState(false)

  function runAndClose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-1">
          {hasLiveGame && (
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => runAndClose(() => onResumeLiveGame())}>
              <RadioTower className="h-4 w-4" />
              Resume live game
            </Button>
          )}
          {!hasLiveGame && (
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => runAndClose(() => onStartLiveGame(prefillCommander))}>
              <Play className="h-4 w-4" />
              Start a live game
            </Button>
          )}
          {hasLiveGame && (
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => runAndClose(() => onStartLiveGame(prefillCommander))}>
              <Play className="h-4 w-4" />
              Start new live game (discard current)
            </Button>
          )}
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => runAndClose(() => onQuickLog(prefillCommander))}>
            <PencilLine className="h-4 w-4" />
            {hasLiveGame ? "Log a game (discard live)" : "Log a game"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
