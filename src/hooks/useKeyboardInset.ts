import { useEffect, useState } from "react"

/** Height (px) of the on-screen keyboard overlapping the layout viewport, 0
 *  when closed. iOS overlays the keyboard without shrinking 100dvh, so
 *  scrollable lists need this as bottom padding to keep their last rows
 *  reachable while typing. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const update = () => {
      const overlap = window.innerHeight - viewport.height - viewport.offsetTop
      setInset(Math.max(0, Math.round(overlap)))
    }

    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
    }
  }, [])

  return inset
}
