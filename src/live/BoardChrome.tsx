import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Play, Timer, ChevronRight, Flag, Undo2, Dices, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ringGrid, useTurnClock, type GameEvent, type LiveGameApi, type LivePlayer } from "./engine"
import { EndGameBanner } from "./shared"
import { SEAT_COLORS } from "./engine"
import { useOrientationLock, type CounterRotation } from "./useOrientationLock"
import { useWakeLock } from "./useWakeLock"

interface BoardChromeProps {
  game: LiveGameApi
  renderSeat: (
    player: LivePlayer,
    opts: { rotated: boolean; side: boolean; rollHighlight?: "rolling" | "picked" | null }
  ) => ReactNode
  centerExtra?: ReactNode
  onSave: () => void
  onRematch: () => void
  onDiscard?: () => void
  saving?: boolean
}

/** offset of the moving control from the player's screen edge */
const EDGE_MARGIN = 48

function RingCell({ id, rotate, area, children }: { id: string; rotate: number; area: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const swap = rotate === 90 || rotate === 270
  const inner = swap ? { width: box.h, height: box.w } : { width: box.w, height: box.h }
  return (
    <div ref={ref} data-seat-cell={id} className="relative overflow-hidden" style={{ gridArea: area }}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{ ...inner, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
      >
        {children}
      </div>
    </div>
  )
}

export function BoardChrome({ game, renderSeat, onSave, onRematch, onDiscard, saving }: BoardChromeProps) {
  const seats = [...game.players].sort((a, b) => a.seatPosition - b.seatPosition)
  const grid = ringGrid(seats.length)
  const rotById: Record<string, number> = {}
  seats.forEach((p, i) => (rotById[p.id] = grid.cells[i].rotate))
  const winner = game.winnerId ? game.players.find((p) => p.id === game.winnerId) ?? null : null

  const counterRotate = useOrientationLock()
  useWakeLock(game.started && game.phase !== "ended")
  // seat-placement phase → roll phase → game phase
  const [readyToRoll, setReadyToRoll] = useState(false)
  const [starterPicked, setStarterPicked] = useState(false)
  // Rolling state lives here (not inside StarterChooser) so the dice-cycle and
  // the winning flash can be drawn on the actual seat panel, at its real table
  // position — a centered "X wins!" card doesn't tell you where to start.
  const [rolling, setRolling] = useState(false)
  const [rollingId, setRollingId] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  useEffect(() => {
    if (!game.started) {
      setReadyToRoll(false)
      setStarterPicked(false)
      setRolling(false)
      setRollingId(null)
      setPickedId(null)
    }
  }, [game.started])

  function rollDice() {
    setPickedId(null)
    setRolling(true)
    let ticks = 0
    let lastPick = seats[0]
    const id = window.setInterval(() => {
      lastPick = seats[Math.floor(Math.random() * seats.length)]
      setRollingId(lastPick.id)
      ticks++
      if (ticks > 14) {
        window.clearInterval(id)
        window.setTimeout(() => {
          setRolling(false)
          setPickedId(lastPick.id)
        }, 200)
      }
    }, 75)
  }

  function pickStarter(seatPosition: LivePlayer["seatPosition"]) {
    game.chooseStarter(seatPosition)
    setStarterPicked(true)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={counterRotationStyle(counterRotate)}>
    <div className="h-full w-full overflow-hidden bg-border">
      <div
        className="grid h-full w-full gap-px"
        style={{
          gridTemplateColumns: grid.columns,
          gridTemplateRows: grid.rows,
          gridTemplateAreas: grid.areas.join(" "),
        }}
      >
        {seats.map((p, i) => {
          const cell = grid.cells[i]
          const choosingStarter = !game.started && !starterPicked
          const rollHighlight: "rolling" | "picked" | null = !choosingStarter
            ? null
            : pickedId === p.id
              ? "picked"
              : rollingId === p.id
                ? "rolling"
                : null
          return (
            <RingCell key={p.id} id={p.id} area={cell.area} rotate={cell.rotate}>
              {renderSeat(p, {
                rotated: cell.rotate === 180,
                side: cell.rotate === 90 || cell.rotate === 270,
                rollHighlight,
              })}
            </RingCell>
          )
        })}
      </div>

      {game.phase === "ended" ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="w-[min(80vw,20rem)]">
            <EndGameBanner winner={winner} onSave={onSave} onRematch={onRematch} onDiscard={onDiscard} saving={saving} />
          </div>
        </div>
      ) : !game.started && !readyToRoll ? (
        <ReadyToRoll onReady={() => setReadyToRoll(true)} />
      ) : !game.started && !starterPicked ? (
        <StarterChooser
          seats={seats}
          rolling={rolling}
          pickedId={pickedId}
          onRoll={rollDice}
          onPick={pickStarter}
        />
      ) : (
        <TurnControl
          game={game}
          rotate={rotById[game.activePlayer.id] ?? 0}
        />
      )}
    </div>
    </div>
  )
}

function counterRotationStyle(r: CounterRotation): React.CSSProperties {
  if (r === 0) return {}
  if (r === 90)  return { width: "100vh", height: "100vw", transform: "rotate(90deg) translateY(-100%)",  transformOrigin: "top left" }
  if (r === -90) return { width: "100vh", height: "100vw", transform: "rotate(-90deg) translateX(-100%)", transformOrigin: "top left" }
  return { transform: "rotate(180deg)", transformOrigin: "center" }
}

/* First overlay: let players get seated and set commanders before rolling.
 * Anchored to true screen center — same as StarterChooser right after it —
 * because that's the one point the ring layouts never place a seat's own
 * controls on. Bottom-center used to sit right on top of the near seat's
 * "+ Commander" button in 2-player games. */
function ReadyToRoll({ onReady }: { onReady: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-white/60 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
          Drag seats · set commanders · then roll
        </p>
        <Button onClick={onReady} size="lg" className="h-14 gap-2 rounded-full px-8 text-base shadow-2xl">
          <Dices className="h-5 w-5" /> Ready to roll
        </Button>
      </div>
    </div>
  )
}

/* Centre control card: kick off the D20 roll, or tap a name to skip it. The
 * dice-cycling and the winner reveal are drawn on the actual seats (BoardChrome
 * passes rollHighlight into renderSeat) — this card no longer visualises "who's
 * winning" itself, since a name in a centered list doesn't say where that
 * player is actually sitting. The winner then gets the Start control at their
 * own edge once confirmed. */
function StarterChooser({
  seats,
  rolling,
  pickedId,
  onRoll,
  onPick,
}: {
  seats: LivePlayer[]
  rolling: boolean
  pickedId: string | null
  onRoll: () => void
  onPick: (seat: LivePlayer["seatPosition"]) => void
}) {
  const pickedPlayer = pickedId ? seats.find((p) => p.id === pickedId) ?? null : null

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="pointer-events-auto flex w-[min(84vw,19rem)] flex-col items-center gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {pickedPlayer ? "Check their seat" : "Who goes first?"}
        </span>
        {pickedPlayer ? (
          <div className="flex w-full flex-col gap-2">
            <p className="text-center text-lg font-bold">
              <span className="text-primary">{pickedPlayer.displayName}</span> goes first!
            </p>
            <div className="flex gap-2">
              <Button onClick={onRoll} variant="outline" className="flex-1 gap-1.5">
                <Dices className="h-4 w-4" /> Re-roll
              </Button>
              <Button onClick={() => onPick(pickedPlayer.seatPosition)} className="flex-1">
                Confirm
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={onRoll} disabled={rolling} size="lg" className="w-full gap-2">
            <Dices className={cn("h-5 w-5", rolling && "animate-spin")} />
            {rolling ? "Rolling…" : "High roll (D20)"}
          </Button>
        )}
        {!rolling && !pickedPlayer && (
          <div className="grid w-full grid-cols-2 gap-1.5">
            {seats.map((p) => {
              const seatColor = SEAT_COLORS[p.seatPosition] ?? "#64748B"
              return (
                <button
                  key={p.id}
                  onClick={() => onPick(p.seatPosition)}
                  style={{ borderColor: seatColor, color: seatColor }}
                  className="truncate rounded-lg border-2 px-2 py-2.5 text-sm font-semibold transition-all active:scale-95"
                >
                  {p.displayName}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* The single turn control — Undo + Start / End turn (clock) / End game — pinned
 * to the active player's near edge, gliding (transform-only, with a bounce) to
 * the next player each turn. */
function TurnControl({
  game,
  rotate,
}: {
  game: LiveGameApi
  rotate: number
}) {
  const clock = useTurnClock(game.turnStartedAt, game.started)
  const activeId = game.activePlayer.id
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [nonce, setNonce] = useState(0)
  const [showLog, setShowLog] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  useLayoutEffect(() => {
    let raf = 0
    const measure = () => {
      const el = document.querySelector(`[data-seat-cell="${activeId}"]`)
      if (!el || (el as HTMLElement).getBoundingClientRect().width === 0) {
        raf = requestAnimationFrame(measure)
        return
      }
      const r = el.getBoundingClientRect()
      const M = EDGE_MARGIN
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      let p: { x: number; y: number }
      if (rotate === 180) p = { x: cx, y: r.top + M }
      else if (rotate === 90) p = { x: r.left + M, y: cy }
      else if (rotate === 270) p = { x: r.right - M, y: cy }
      else p = { x: cx, y: r.bottom - M }
      setPos(p)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [activeId, rotate, nonce])

  useEffect(() => {
    const onResize = () => setNonce((n) => n + 1)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  if (!pos) return null

  const main = !game.started ? (
    <Button onClick={game.start} className="h-12 gap-1.5 rounded-full px-5 text-base">
      <Play className="h-4 w-4 fill-current" /> Start
    </Button>
  ) : game.canEnd ? (
    <Button onClick={game.endGame} className="h-12 gap-1.5 rounded-full px-5 text-base">
      <Flag className="h-4 w-4" /> End game
    </Button>
  ) : (
    <Button onClick={game.endTurn} className="h-12 gap-2 rounded-full px-5 text-base tabular-nums">
      <Timer className="h-4 w-4 opacity-80" />
      {clock}
      <span className="opacity-90">End turn</span>
      <ChevronRight className="h-4 w-4" />
    </Button>
  )

  return (
    <>
      <div
        className="fixed left-0 top-0 z-40 will-change-transform"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) rotate(${rotate}deg)`,
          transition: "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-xl backdrop-blur">
          <button
            onClick={() => { if (game.canUndo) setShowLog(true) }}
            disabled={!game.canUndo}
            aria-label="undo"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              game.canUndo ? "text-foreground active:scale-95" : "cursor-not-allowed text-muted-foreground/40"
            )}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          {main}
          {game.started && !game.canEnd && (
            <button
              onClick={() => setShowEndConfirm(true)}
              aria-label="end game early"
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-95 hover:text-foreground"
            >
              <Flag className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showLog && (
        <UndoLog
          events={game.events}
          players={game.players}
          onUndoTo={(i) => { game.undoToIndex(i); setShowLog(false) }}
          onUndoLast={() => { game.undoLast(); setShowLog(false) }}
          onClose={() => setShowLog(false)}
        />
      )}

      {showEndConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
          <div className="w-[min(84vw,20rem)] rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <p className="font-semibold text-center">End game early?</p>
            <p className="text-sm text-muted-foreground text-center">This will end the game even though there are still players alive.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowEndConfirm(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => { setShowEndConfirm(false); game.endGame() }}>End game</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UndoLog({
  events,
  players,
  onUndoTo,
  onUndoLast,
  onClose,
}: {
  events: GameEvent[]
  players: LivePlayer[]
  onUndoTo: (index: number) => void
  onUndoLast: () => void
  onClose: () => void
}) {
  const nameById = Object.fromEntries(players.map((p) => [p.id, p.displayName]))

  function label(ev: GameEvent): string {
    if (ev.kind === "turn") return `— End of turn ${ev.turn} —`
    const target = nameById[ev.targetId] ?? "?"
    if (ev.sourceId) {
      const src = nameById[ev.sourceId] ?? "?"
      const type = ev.isCommander ? " (cmdr)" : ev.isPoison ? " (poison)" : ""
      return `${src} → ${target}: ${ev.amount > 0 ? "+" : ""}${ev.amount}${type}`
    }
    return `${target}: ${ev.amount > 0 ? "-" : "+"}${Math.abs(ev.amount)} life`
  }

  function turnOf(ev: GameEvent): number {
    return ev.kind === "turn" ? ev.turn : ev.turn
  }

  const recent = [...events].reverse()

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[min(88vw,22rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold text-sm">Action log</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onUndoLast} className="h-7 gap-1 text-xs">
              <Undo2 className="h-3 w-3" /> Undo last
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-border">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No actions yet</p>
          ) : (
            recent.map((ev, ri) => {
              const originalIndex = events.length - 1 - ri
              const isTurnMarker = ev.kind === "turn"
              return (
                <button
                  key={ev.id}
                  onClick={() => onUndoTo(originalIndex)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center justify-between gap-2",
                    isTurnMarker && "bg-muted/40 text-muted-foreground"
                  )}
                >
                  <span className="font-mono text-xs text-muted-foreground shrink-0">T{turnOf(ev)}</span>
                  <span className={cn("flex-1 truncate", isTurnMarker && "italic text-xs")}>{label(ev)}</span>
                  <span className="text-xs text-muted-foreground shrink-0">undo to here</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
