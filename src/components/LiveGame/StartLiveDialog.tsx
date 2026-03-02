import { useEffect, useState } from "react"
import twoRaw from "./svgs/twoPlayers.svg?raw"
import threeRaw from "./svgs/threePlayers.svg?raw"
import fourRaw from "./svgs/fourPlayers.svg?raw"
import fiveRaw from "./svgs/fivePlayers.svg?raw"
import sixRaw from "./svgs/sixPlayers.svg?raw"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function StartLiveDialog({ open, onClose, onSelectLayout }: { open: boolean; onClose: () => void; onSelectLayout?: (players: number) => void }) {
  useEffect(() => {}, [])

  const items = [
    { players: 2, raw: twoRaw, label: '2 Players' },
    { players: 3, raw: threeRaw, label: '3 Players' },
    { players: 4, raw: fourRaw, label: '4 Players' },
    { players: 5, raw: fiveRaw, label: '5 Players' },
    { players: 6, raw: sixRaw, label: '6 Players' },
  ]

  const [selected, setSelected] = useState<number | null>(null)

  const seatPositions: Record<number, { left: string; top: string }[]> = {
    2: [{ left: '50%', top: '12%' }, { left: '50%', top: '88%' }],
    3: [{ left: '50%', top: '8%' }, { left: '82%', top: '50%' }, { left: '50%', top: '92%' }],
    4: [{ left: '20%', top: '20%' }, { left: '80%', top: '20%' }, { left: '20%', top: '80%' }, { left: '80%', top: '80%' }],
    5: [{ left: '50%', top: '8%' }, { left: '18%', top: '32%' }, { left: '82%', top: '32%' }, { left: '30%', top: '78%' }, { left: '70%', top: '78%' }],
    6: [{ left: '25%', top: '12%' }, { left: '75%', top: '12%' }, { left: '25%', top: '44%' }, { left: '75%', top: '44%' }, { left: '25%', top: '76%' }, { left: '75%', top: '76%' }],
  }

  function renderSvg(raw: string) {
    return raw
      .replace(/width="[^"]+"/g, 'width="100%"')
      .replace(/height="[^"]+"/g, 'height="auto"')
      .replace(/fill="#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})"/g, 'fill="currentColor"')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-full max-w-3xl">
        <DialogTitle>Select layout</DialogTitle>
        <DialogDescription>Choose a seating layout to start a live game.</DialogDescription>

        {!selected ? (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {items.map((it) => (
                <button
                  key={it.players}
                  onClick={() => setSelected(it.players)}
                  className={cn("rounded-lg border p-3 flex flex-col items-center gap-2 hover:shadow focus:shadow outline-none")}
                >
                  <div className="w-full h-40 text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: renderSvg(it.raw) }} />
                  <div className="text-sm font-medium">{it.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-col items-center gap-4">
              <div className="w-full sm:w-[80%] relative">
                <div className="w-full h-72 sm:h-64 bg-transparent overflow-hidden">
                  <div className="w-full h-full text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: renderSvg(items.find(i => i.players === selected)!.raw) }} />
                </div>
                {seatPositions[selected].map((pos, idx) => (
                  <div key={idx} style={{ left: pos.left, top: pos.top }} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                    <div className="text-black dark:text-white text-2xl sm:text-5xl font-bold">Player {idx + 1}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Back</Button>
                <Button onClick={() => { onSelectLayout?.(selected); onClose() }}>Use layout</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
import { useEffect, useState } from "react"
import twoRaw from "./svgs/twoPlayers.svg?raw"
import threeRaw from "./svgs/threePlayers.svg?raw"
import fourRaw from "./svgs/fourPlayers.svg?raw"
import fiveRaw from "./svgs/fivePlayers.svg?raw"
import sixRaw from "./svgs/sixPlayers.svg?raw"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Simplified modal: allow selecting a layout (2-6 players) by clicking an SVG tile.
export default function StartLiveDialog({ open, onClose, onSelectLayout }: { open: boolean; onClose: () => void; onSelectLayout?: (players: number) => void }) {
  useEffect(() => {
    // noop for now
  }, [])

  const items = [
    { players: 2, raw: twoRaw, label: '2 Players' },
    { players: 3, raw: threeRaw, label: '3 Players' },
    { players: 4, raw: fourRaw, label: '4 Players' },
    { players: 5, raw: fiveRaw, label: '5 Players' },
    { players: 6, raw: sixRaw, label: '6 Players' },
  ]
  
  const [selected, setSelected] = useState<number | null>(null)

  const seatPositions: Record<number, { left: string; top: string }[]> = {
    2: [ { left: '50%', top: '12%' }, { left: '50%', top: '88%' } ],
    3: [ { left: '50%', top: '8%' }, { left: '82%', top: '50%' }, { left: '50%', top: '92%' } ],
    4: [ { left: '20%', top: '20%' }, { left: '80%', top: '20%' }, { left: '20%', top: '80%' }, { left: '80%', top: '80%' } ],
    5: [ { left: '50%', top: '8%' }, { left: '18%', top: '32%' }, { left: '82%', top: '32%' }, { left: '30%', top: '78%' }, { left: '70%', top: '78%' } ],
    6: [ { left: '25%', top: '12%' }, { left: '75%', top: '12%' }, { left: '25%', top: '44%' }, { left: '75%', top: '44%' }, { left: '25%', top: '76%' }, { left: '75%', top: '76%' } ],
  }

  function renderSvg(raw: string) {
      return raw
        .replace(/width="[^"]+"/g, 'width="100%"')
        .replace(/height="[^"]+"/g, 'height="auto"')
        .replace(/fill="#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})"/g, 'fill="currentColor"')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-full max-w-3xl">
        <DialogTitle>Select layout</DialogTitle>
        <DialogDescription>Choose a seating layout to start a live game.</DialogDescription>

        {!selected ? (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {items.map((it) => (
                <button
                  key={it.players}
                  onClick={() => setSelected(it.players)}
                  className={cn(
                    "rounded-lg border p-3 flex flex-col items-center gap-2 hover:shadow focus:shadow outline-none",
                  )}
                >
                  <div className="w-full h-40 text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: renderSvg(it.raw) }} />
                  <div className="text-sm font-medium">{it.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-col items-center gap-4">
              <div className="w-full sm:w-[80%] relative">
                <div className="w-full h-72 sm:h-64 bg-transparent overflow-hidden">
                  <div className="w-full h-full text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: renderSvg(items.find(i => i.players === selected)!.raw) }} />
                </div>
                {seatPositions[selected].map((pos, idx) => (
                  <div key={idx} style={{ left: pos.left, top: pos.top }} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                    <div className="text-black dark:text-white text-2xl sm:text-5xl font-bold">Player {idx + 1}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Back</Button>
                <Button onClick={() => { onSelectLayout?.(selected); onClose() }}>Use layout</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
import { useEffect, useState } from "react"
import twoRaw from "./svgs/twoPlayers.svg?raw"
import threeRaw from "./svgs/threePlayers.svg?raw"
import fourRaw from "./svgs/fourPlayers.svg?raw"
import fiveRaw from "./svgs/fivePlayers.svg?raw"
import sixRaw from "./svgs/sixPlayers.svg?raw"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Simplified modal: allow selecting a layout (2-6 players) by clicking an SVG tile.
export function StartLiveDialog({ open, onClose, onSelectLayout }: { open: boolean; onClose: () => void; onSelectLayout?: (players: number) => void }) {
  useEffect(() => {
    // noop for now
  }, [])

  const items = [
    { players: 2, raw: twoRaw, label: '2 Players' },
    { players: 3, raw: threeRaw, label: '3 Players' },
    { players: 4, raw: fourRaw, label: '4 Players' },
    { players: 5, raw: fiveRaw, label: '5 Players' },
    { players: 6, raw: sixRaw, label: '6 Players' },
  ]
  
  const [selected, setSelected] = useState<number | null>(null)

  const seatPositions: Record<number, { left: string; top: string }[]> = {
    2: [ { left: '50%', top: '12%' }, { left: '50%', top: '88%' } ],
    3: [ { left: '50%', top: '8%' }, { left: '82%', top: '50%' }, { left: '50%', top: '92%' } ],
    4: [ { left: '20%', top: '20%' }, { left: '80%', top: '20%' }, { left: '20%', top: '80%' }, { left: '80%', top: '80%' } ],
    5: [ { left: '50%', top: '8%' }, { left: '18%', top: '32%' }, { left: '82%', top: '32%' }, { left: '30%', top: '78%' }, { left: '70%', top: '78%' } ],
    6: [ { left: '25%', top: '12%' }, { left: '75%', top: '12%' }, { left: '25%', top: '44%' }, { left: '75%', top: '44%' }, { left: '25%', top: '76%' }, { left: '75%', top: '76%' } ],
  }

  function renderSvg(raw: string) {
      return raw
        .replace(/width="[^"]+"/g, 'width="100%"')
        .replace(/height="[^"]+"/g, 'height="auto"')
        .replace(/fill="#[0-9A-Fa-f]{3,6}"/g, 'fill="currentColor"')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-full max-w-3xl">
        <DialogTitle>Select layout</DialogTitle>
        <DialogDescription>Choose a seating layout to start a live game.</DialogDescription>

        {!selected ? (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {items.map((it) => (
                <button
                  key={it.players}
                  onClick={() => setSelected(it.players)}
                  className={cn(
                    "rounded-lg border p-3 flex flex-col items-center gap-2 hover:shadow focus:shadow outline-none",
                  )}
                >
                  <div className="w-full h-40 text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: renderSvg(it.raw) }} />
                  <div className="text-sm font-medium">{it.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-col items-center gap-4">
              <div className="w-full sm:w-[80%] relative">
                <div className="w-full h-72 sm:h-64 bg-transparent overflow-hidden">
                  <div className="w-full h-full text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: renderSvg(items.find(i => i.players === selected)!.raw) }} />
                </div>
                {seatPositions[selected].map((pos, idx) => (
                  <div key={idx} style={{ left: pos.left, top: pos.top }} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                    <div className="text-black dark:text-white text-2xl sm:text-5xl font-bold">Player {idx + 1}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Back</Button>
                <Button onClick={() => { onSelectLayout?.(selected); onClose() }}>Use layout</Button>
              </div>
            </div>
          </>
        )}
>>>>>>> origin/main
      </DialogContent>
    </Dialog>
  )
}
<<<<<<< HEAD
=======

export default StartLiveDialog
>>>>>>> origin/main
