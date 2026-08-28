import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { capture } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import type { OnboardingStatus } from "@/lib/onboarding"
import { TOUR_STEPS } from "./steps"
import { BoardSketch } from "./BoardSketch"

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const SPOTLIGHT_PAD = 8
const CARD_GAP = 14
const EDGE = 12
const CARD_WIDTH = 340
/** frames to wait for a target to mount before falling back to a centred card */
const TARGET_FRAMES = 90

function sameBox(a: Box | null, b: Box): boolean {
  return (
    !!a &&
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  )
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/* Guided walkthrough: spotlights real elements across the stats, track-game,
 * and live-game surfaces, driving the app there itself as it goes. */
export function OnboardingTour({
  open,
  sampleData,
  onNavigate,
  onOpenLogGame,
  onCloseLogGame,
  onFinish,
}: {
  open: boolean
  /** the app behind the tour is showing a sample pod, not the user's games */
  sampleData?: boolean
  onNavigate: (path: string) => void
  onOpenLogGame: () => void
  onCloseLogGame: () => void
  onFinish: (status: OnboardingStatus, stepId: string, stepIndex: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [cardHeight, setCardHeight] = useState(0)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }))
  const cardRef = useRef<HTMLDivElement>(null)
  const step = TOUR_STEPS[Math.min(index, TOUR_STEPS.length - 1)]
  const isLast = index === TOUR_STEPS.length - 1

  const finish = useCallback(
    (status: OnboardingStatus) => {
      if (status === "completed") capture("onboarding_completed", { steps: TOUR_STEPS.length })
      else capture("onboarding_skipped", { step_id: step.id, step_index: index })
      onFinish(status, step.id, index)
    },
    [index, onFinish, step.id],
  )

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  // Move the app to the surface this step is about, then announce the step.
  useEffect(() => {
    if (!open) return
    if (step.drawer === "log") onOpenLogGame()
    if (step.drawer === "none") onCloseLogGame()
    if (step.route) onNavigate(step.route)
    capture("onboarding_step_viewed", { step_id: step.id, step_index: index })
    // Deliberately keyed on the step alone — the callbacks are re-created on
    // every App render and would otherwise re-run the navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index])

  // Track the target's position for as long as the step is up, so the
  // spotlight survives scrolling, drawer transitions, and layout shifts.
  useEffect(() => {
    if (!open) return
    if (!step.target) {
      setBox(null)
      return
    }
    const selector = `[data-tour="${step.target}"]`
    setBox(null)
    let frame = 0
    let frames = 0
    let scrolled = false
    const tick = () => {
      const el = document.querySelector(selector)
      if (el) {
        if (!scrolled) {
          scrolled = true
          el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" })
        }
        const r = el.getBoundingClientRect()
        const next = { top: r.top, left: r.left, width: r.width, height: r.height }
        if (next.width > 0 && next.height > 0) {
          setBox((prev) => (sameBox(prev, next) ? prev : next))
        }
      } else if (frames > TARGET_FRAMES) {
        setBox(null)
      }
      frames++
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open, index, step.target])

  useEffect(() => {
    if (!open) return
    function onResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        finish("skipped")
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        if (isLast) finish("completed")
        else setIndex((i) => i + 1)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, isLast, finish])

  // The card is positioned around the spotlight, so its measured height has to
  // feed back into that placement.
  useLayoutEffect(() => {
    if (!open) return
    const h = cardRef.current?.offsetHeight ?? 0
    if (h && h !== cardHeight) setCardHeight(h)
  }, [open, index, cardHeight, box])

  if (!open) return null

  const vw = viewport.width || 360
  const vh = viewport.height || 640
  const cardWidth = Math.min(CARD_WIDTH, vw - EDGE * 2)
  const spot = box
    ? {
        top: box.top - SPOTLIGHT_PAD,
        left: box.left - SPOTLIGHT_PAD,
        width: box.width + SPOTLIGHT_PAD * 2,
        height: box.height + SPOTLIGHT_PAD * 2,
      }
    : null

  let cardStyle: React.CSSProperties
  if (!spot) {
    cardStyle = { left: (vw - cardWidth) / 2, top: Math.max(EDGE, (vh - cardHeight) / 2), width: cardWidth }
  } else {
    const below = spot.top + spot.height + CARD_GAP
    const above = spot.top - CARD_GAP - cardHeight
    const top =
      below + cardHeight + EDGE <= vh
        ? below
        : above >= EDGE
          ? above
          : Math.max(EDGE, vh - cardHeight - EDGE)
    const left = Math.min(
      Math.max(EDGE, spot.left + spot.width / 2 - cardWidth / 2),
      Math.max(EDGE, vw - cardWidth - EDGE),
    )
    cardStyle = { left, top, width: cardWidth }
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="App walkthrough">
      {/* Click shield — the tour drives the app itself, so taps behind it are
          swallowed rather than half-completing a flow mid-step. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {spot ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.66)",
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/70" />
      )}

      <div
        ref={cardRef}
        data-testid="onboarding-card"
        className="absolute rounded-2xl border border-border bg-card p-4 shadow-2xl"
        style={cardStyle}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Step {index + 1} of {TOUR_STEPS.length}
            </span>
            {sampleData && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
                Sample data
              </span>
            )}
          </span>
          <button
            onClick={() => finish("skipped")}
            className="-mr-1 -mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Skip tour
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h2 className="text-base font-semibold tracking-tight">{step.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
        {sampleData && index === 0 && (
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Your account is empty, so the screens behind this are filled with a sample pod. Your own
            games replace it the moment you log one.
          </p>
        )}
        {step.sketch === "live-board" && <BoardSketch />}
        {step.bullets && (
          <ul className="mt-2.5 space-y-1.5">
            {step.bullets.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-1.5" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= index ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => (isLast ? finish("completed") : setIndex((i) => i + 1))}
          >
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
