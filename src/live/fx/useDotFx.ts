import { useEffect, useRef, useState } from "react"
import { DotFx } from "./engine"

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  } catch {
    return false
  }
}

/** Mounts the dot layer on a canvas. `fx` stays null under reduced motion or
 *  without a 2D context, and callers fall back to the plain static visuals. */
export function useDotFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fx, setFx] = useState<DotFx | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prefersReducedMotion()) return
    let engine: DotFx
    try {
      engine = new DotFx(canvas)
    } catch {
      return
    }
    if (!engine.hasContext) return
    setFx(engine)
    const onResize = () => engine.resize()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      engine.destroy()
      setFx(null)
    }
  }, [])

  return { fx, canvasRef }
}
