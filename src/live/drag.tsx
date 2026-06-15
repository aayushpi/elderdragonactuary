import { useCallback, useEffect, useRef, useState } from "react"

/* ============================================================================
 * Drag-to-attack — the shared direct-manipulation core.
 *
 * A drag always *starts on a source seat*, so direction (who dealt it) is
 * captured by the gesture itself — any seat can attack any seat at any time,
 * regardless of whose turn it is. Targeting is geometric: we hit-test the
 * pointer against any element carrying `data-seat-id`, so CSS rotation of the
 * far-side band is transparent (screen coordinates, not transformed ones).
 *
 * `P` is an optional payload carried by the drag (e.g. a sized damage token).
 * ==========================================================================*/

export interface DragInfo<P = undefined> {
  sourceId: string
  startX: number
  startY: number
  x: number
  y: number
  targetId: string | null
  payload: P
}

interface DragHandlers<P> {
  onDrop: (sourceId: string, targetId: string, point: { x: number; y: number }, payload: P) => void
  onHover?: (targetId: string | null, payload: P) => void
}

function hitTestSeat(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const seat = el?.closest("[data-seat-id]") as HTMLElement | null
  return seat?.getAttribute("data-seat-id") ?? null
}

export function useDragAttack<P = undefined>(handlers: DragHandlers<P>) {
  const [drag, setDrag] = useState<DragInfo<P> | null>(null)
  const dragRef = useRef<DragInfo<P> | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const start = useCallback((sourceId: string, e: React.PointerEvent, payload: P) => {
    e.preventDefault()
    e.stopPropagation()
    const info: DragInfo<P> = {
      sourceId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      targetId: null,
      payload,
    }
    dragRef.current = info
    setDrag(info)

    const move = (ev: PointerEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const hit = hitTestSeat(ev.clientX, ev.clientY)
      const targetId = hit && hit !== cur.sourceId ? hit : null
      const next = { ...cur, x: ev.clientX, y: ev.clientY, targetId }
      dragRef.current = next
      setDrag(next)
      if (targetId !== cur.targetId) handlersRef.current.onHover?.(targetId, cur.payload)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      handlersRef.current.onHover?.(null, cur?.payload as P)
      if (cur?.targetId) {
        handlersRef.current.onDrop(cur.sourceId, cur.targetId, { x: ev.clientX, y: ev.clientY }, cur.payload)
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }, [])

  return { drag, start }
}

/* While a drag is in progress, lock page scrolling / text selection. */
export function useDragLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.touchAction
    document.body.style.touchAction = "none"
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.touchAction = prev
      document.body.style.userSelect = ""
    }
  }, [active])
}
