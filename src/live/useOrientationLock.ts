import { useEffect, useRef, useState } from "react"

export type CounterRotation = 0 | 90 | -90 | 180

function currentAngle(): number {
  if (typeof screen === "undefined") return 0
  // screen.orientation.angle is available on Safari 16.4+ and all Android Chrome
  if (screen.orientation?.angle !== undefined) return screen.orientation.angle
  return 0
}

/** Locks the screen to whatever orientation was active when the component mounted.
 *  On Android Chrome (standalone PWA) this uses the Screen Orientation API.
 *  On iOS Safari it falls back to a CSS counter-rotation — the returned value
 *  tells the caller how many degrees to rotate the board wrapper to undo the
 *  OS rotation visually. */
export function useOrientationLock(): CounterRotation {
  const lockedAngle = useRef(currentAngle())
  const [counterRotate, setCounterRotate] = useState<CounterRotation>(0)

  useEffect(() => {
    // Try the native API first (works on Android Chrome in standalone mode)
    const ori = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> }
    if (ori?.lock && ori?.type) {
      ori.lock(ori.type).catch(() => {/* iOS / desktop: unsupported — fall through to CSS approach */})
    }

    function update() {
      const delta = ((lockedAngle.current - currentAngle()) + 360) % 360
      const r: CounterRotation = delta === 90 ? 90 : delta === 180 ? 180 : delta === 270 ? -90 : 0
      setCounterRotate(r)
    }

    screen.orientation?.addEventListener("change", update)
    // Legacy iOS orientationchange — still fires reliably on all iOS versions
    window.addEventListener("orientationchange", update)

    return () => {
      screen.orientation?.removeEventListener("change", update)
      window.removeEventListener("orientationchange", update)
      try { ori?.unlock?.() } catch { /* ignore */ }
    }
  }, [])

  return counterRotate
}
