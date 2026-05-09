import { useCallback, useEffect, useRef, useState } from "react"
import { GripVertical } from "lucide-react"
import type { Player, SeatPosition } from "@/types"

const DRAG_THRESHOLD = 8

interface SeatGridProps {
  players: Partial<Player>[]
  onSwap: (slotA: SeatPosition, slotB: SeatPosition) => void
}

export function SeatGrid({ players, onSwap }: SeatGridProps) {
  const [overSlot, setOverSlot] = useState<SeatPosition | null>(null)
  const [dragSource, setDragSource] = useState<SeatPosition | null>(null)
  const [pickedUpSlot, setPickedUpSlot] = useState<SeatPosition | null>(null)
  const announceRef = useRef<HTMLDivElement>(null)

  const dragSession = useRef<{
    pointerId: number | null
    sourceSlot: SeatPosition | null
    startX: number
    startY: number
    live: boolean
    ghost: HTMLDivElement | null
    cleanup: (() => void) | null
  }>({ pointerId: null, sourceSlot: null, startX: 0, startY: 0, live: false, ghost: null, cleanup: null })

  const sorted = [...players]
    .filter((p): p is Partial<Player> & { seatPosition: SeatPosition } => p.seatPosition !== undefined)
    .sort((a, b) => a.seatPosition - b.seatPosition)

  // Clear picked-up slot if it no longer exists (player count changed)
  useEffect(() => {
    if (pickedUpSlot !== null && !sorted.some((p) => p.seatPosition === pickedUpSlot)) {
      setPickedUpSlot(null)
    }
  }, [players, pickedUpSlot]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { dragSession.current.cleanup?.() }
  }, [])

  function announce(msg: string) {
    if (announceRef.current) announceRef.current.textContent = msg
  }

  const findSlotUnder = useCallback((x: number, y: number): SeatPosition | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const seat = (el as HTMLElement).dataset.seat
      if (seat) return parseInt(seat) as SeatPosition
    }
    return null
  }, [])

  function createGhost(cardEl: HTMLElement, player: Partial<Player>, seat: SeatPosition): HTMLDivElement {
    const rect = cardEl.getBoundingClientRect()
    const ghost = document.createElement("div")
    ghost.setAttribute("aria-hidden", "true")
    ghost.style.cssText = [
      `position:fixed`,
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      `pointer-events:none`,
      `z-index:9999`,
      `opacity:0.95`,
      `box-shadow:0 8px 24px rgba(0,0,0,0.3)`,
      `border-radius:8px`,
      `background:var(--card)`,
      `border:1px solid var(--border)`,
      `color:var(--foreground)`,
      `display:flex`,
      `align-items:center`,
      `gap:8px`,
      `padding:8px 10px`,
      `overflow:hidden`,
    ].join(";")
    ghost.innerHTML = `
      <span style="font-size:11px;font-weight:700;opacity:0.6;flex-shrink:0;width:16px;text-align:center">${seat}</span>
      <div style="min-width:0;flex:1">
        <p style="margin:0;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${player.displayName ?? `Player ${seat}`}
        </p>
        <p style="margin:0;font-size:11px;opacity:0.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${player.commanderName ?? "No commander"}
        </p>
      </div>
    `
    if (player.commanderImageUri) {
      const img = document.createElement("img")
      img.src = player.commanderImageUri
      img.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.1;pointer-events:none"
      ghost.prepend(img)
    }
    document.body.appendChild(ghost)
    return ghost
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, slot: SeatPosition, player: Partial<Player>) => {
      if (dragSession.current.pointerId !== null) return

      e.preventDefault()

      const session = dragSession.current
      session.cleanup?.()
      session.pointerId = e.pointerId
      session.sourceSlot = slot
      session.startX = e.clientX
      session.startY = e.clientY
      session.live = false
      session.ghost = null

      const cardEl = e.currentTarget

      function onMove(ev: PointerEvent) {
        if (ev.pointerId !== dragSession.current.pointerId) return
        const ds = dragSession.current

        if (!ds.live) {
          const dist = Math.hypot(ev.clientX - ds.startX, ev.clientY - ds.startY)
          if (dist < DRAG_THRESHOLD) return
          ds.live = true
          ds.ghost = createGhost(cardEl, player, slot)
          setDragSource(slot)
        }

        if (ds.ghost) {
          ds.ghost.style.transform = `translate(${ev.clientX - ds.startX}px,${ev.clientY - ds.startY}px)`
        }

        const under = findSlotUnder(ev.clientX, ev.clientY)
        setOverSlot(under !== null && under !== slot ? under : null)
      }

      function onUp(ev: PointerEvent) {
        if (ev.pointerId !== dragSession.current.pointerId) return
        const ds = dragSession.current
        const wasLive = ds.live
        const source = ds.sourceSlot!

        cleanupSession()

        if (!wasLive) return

        const target = findSlotUnder(ev.clientX, ev.clientY)
        if (target !== null && target !== source) {
          onSwap(source, target)
          announce(`Seat ${source} and Seat ${target} swapped`)
        }
      }

      function onCancel() {
        cleanupSession()
      }

      function cleanupSession() {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onCancel)
        const ds = dragSession.current
        if (ds.ghost) {
          document.body.removeChild(ds.ghost)
          ds.ghost = null
        }
        ds.pointerId = null
        ds.sourceSlot = null
        ds.live = false
        ds.cleanup = null
        setDragSource(null)
        setOverSlot(null)
      }

      session.cleanup = cleanupSession
      window.addEventListener("pointermove", onMove, { passive: true })
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onCancel)
    },
    [findSlotUnder, onSwap]
  )

  function handleKeyDown(e: React.KeyboardEvent, slot: SeatPosition) {
    if (e.key === "Escape") {
      setPickedUpSlot(null)
      announce("Cancelled")
      return
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      if (pickedUpSlot === null) {
        setPickedUpSlot(slot)
        announce(`Seat ${slot} selected. Press Space or Enter on another seat to swap, Escape to cancel.`)
      } else if (pickedUpSlot === slot) {
        setPickedUpSlot(null)
        announce("Deselected")
      } else {
        onSwap(pickedUpSlot, slot)
        announce(`Seat ${pickedUpSlot} and Seat ${slot} swapped`)
        setPickedUpSlot(null)
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <div ref={announceRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div role="listbox" aria-label="Player seat order" className="flex flex-wrap gap-2">
        {sorted.map((player) => {
          const seat = player.seatPosition
          const isSource = dragSource === seat
          const isOver = overSlot === seat
          const isPickedUp = pickedUpSlot === seat
          const isPickTarget = pickedUpSlot !== null && pickedUpSlot !== seat

          return (
            <div
              key={player.id ?? seat}
              role="option"
              aria-selected={isPickedUp}
              aria-grabbed={isSource || undefined}
              aria-label={`Seat ${seat} — ${player.displayName ?? player.commanderName ?? `Player ${seat}`}`}
              tabIndex={0}
              data-seat={seat}
              style={{ touchAction: "none" }}
              className={[
                "relative flex items-center gap-2 rounded-lg border p-2 pr-3 overflow-hidden bg-card",
                "cursor-grab active:cursor-grabbing select-none transition-all duration-150",
                "min-w-[130px] flex-1",
                isSource ? "opacity-40 scale-[0.97] border-dashed" : "",
                isOver ? "ring-2 ring-primary bg-primary/10 scale-[1.02]" : "",
                isPickedUp ? "ring-2 ring-primary animate-pulse" : "",
                isPickTarget ? "ring-1 ring-dashed ring-muted-foreground" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerDown={(e) => handlePointerDown(e, seat, player)}
              onKeyDown={(e) => handleKeyDown(e, seat)}
            >
              {player.commanderImageUri && (
                <img
                  src={player.commanderImageUri}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
                />
              )}
              <span className="relative z-10 text-xs font-bold text-muted-foreground w-4 text-center shrink-0">
                {seat}
              </span>
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-xs font-medium leading-tight truncate">
                  {player.displayName || `Player ${seat}`}
                </p>
                <p className="text-xs text-muted-foreground leading-tight truncate">
                  {player.commanderName || "No commander"}
                </p>
              </div>
              <GripVertical className="relative z-10 h-4 w-4 text-muted-foreground shrink-0 opacity-40" />
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">Drag to rearrange seat order</p>
    </div>
  )
}
