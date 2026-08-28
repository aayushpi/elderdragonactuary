import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { Trophy, RotateCcw, Save, Skull, Heart, Minus, Plus, Trash2, Pencil, X, Dices, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LETHAL_COMMANDER, LETHAL_POISON, SEAT_COLORS, type LivePlayer, type PlayerRuntime } from "./engine"
import type { DragInfo } from "./drag"
import { copy } from "@/copy"

/* The live attack vector drawn from the source handle to the finger. Lives here
 * (with the other components) so drag.tsx stays a hooks-only module. */
export function DragVector<P>({ drag, label }: { drag: DragInfo<P> | null; label?: string }) {
  if (!drag) return null
  const armed = drag.targetId != null
  const color = armed ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"
  return (
    <svg className="pointer-events-none fixed inset-0 z-[55] h-full w-full overflow-visible">
      <line
        x1={drag.startX}
        y1={drag.startY}
        x2={drag.x}
        y2={drag.y}
        stroke={color}
        strokeWidth={armed ? 5 : 3}
        strokeLinecap="round"
        strokeDasharray={armed ? undefined : "6 8"}
      />
      <circle cx={drag.startX} cy={drag.startY} r={5} fill={color} />
      <circle cx={drag.x} cy={drag.y} r={armed ? 16 : 9} fill={color} />
      {label && (
        <text
          x={drag.x}
          y={drag.y}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white text-[13px] font-bold"
        >
          {label}
        </text>
      )}
    </svg>
  )
}


/** how long a tap burst's running total stays up; each tap restarts it */
const TALLY_MS = 1600

function vibrate(ms: number) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
}

/* ---- Press-and-hold stepper button ----
 * A tap applies `shortDelta`; holding past ~450ms applies `longDelta` once (the
 * ±10 "big step"). Pointer capture keeps the release on the button even if the
 * finger drifts, so taps on small targets stay reliable. */
const HOLD_MS = 450
export function HoldStepButton({
  onStep,
  shortDelta,
  longDelta,
  className,
  ariaLabel,
  children,
}: {
  onStep: (delta: number) => void
  shortDelta: number
  longDelta: number
  className?: string
  ariaLabel?: string
  children: ReactNode
}) {
  const firedLong = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  function clear() {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current)
      timer.current = undefined
    }
  }
  function down(e: ReactPointerEvent) {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    firedLong.current = false
    timer.current = window.setTimeout(() => {
      firedLong.current = true
      vibrate(55)
      onStep(longDelta)
    }, HOLD_MS)
  }
  function up() {
    clear()
    if (!firedLong.current) {
      vibrate(20)
      onStep(shortDelta)
    }
  }

  return (
    <button
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={clear}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </button>
  )
}


/* ---- Edge-to-edge seat panel — bright fill or commander art ----
 * Identity is the full-bleed colour (or the commander's art when set). Life is
 * a big number with explicit ± buttons; the *weighty draggable pill* is the
 * attack grip (supplied via `attackSlot`). The board flags a live drop target
 * with `dragTarget` + a `preview` badge. */
export function SeatFrame({
  player,
  rt,
  isActive,
  side,
  preGame,
  swapSlot,
  dragTarget,
  preview,
  attackSlot,
  onSetCommander,
  onSelfChange,
  onRevive,
  onKnockout,
  commanderSources,
  onShowDamage,
  rollHighlight,
}: {
  player: LivePlayer
  rt: PlayerRuntime
  isActive: boolean
  /** left/right seat: shift life inward so the active player's edge control doesn't cover it */
  side?: boolean
  /** before the game starts: hide life/attack, emphasize name/commander/swap */
  preGame?: boolean
  /** the drag-to-swap grip, shown in the pre-game layout */
  swapSlot?: ReactNode
  dragTarget?: boolean
  preview?: string | null
  attackSlot?: ReactNode
  /** when the seat has no commander yet, this fires to assign one (deferred) */
  onSetCommander?: () => void
  onSelfChange: (delta: number) => void
  onRevive: () => void
  onKnockout: () => void
  /** per-source commander damage with display names */
  commanderSources?: Array<{ name: string; amount: number }>
  /** open the full commander-damage + poison breakdown modal for this seat */
  onShowDamage?: () => void
  /** high-roll state, drawn right on this seat so the winner's table position
   *  is unmistakable — a centered "X wins!" card doesn't say where to start */
  rollHighlight?: "rolling" | "picked" | null
}) {
  const prevLifeRef = useRef(rt.life)
  const [flash, setFlash] = useState<"damage" | "heal" | null>(null)
  const [artFailed, setArtFailed] = useState(false)
  // Running total of the taps in this burst, so five taps of − read as "−5"
  // rather than five separate "−1"s. `seq` restarts the float animation.
  const [tally, setTally] = useState<{ amount: number; seq: number } | null>(null)

  function stepLife(delta: number) {
    setTally((prev) => ({ amount: (prev?.amount ?? 0) - delta, seq: (prev?.seq ?? 0) + 1 }))
    onSelfChange(delta)
  }

  useEffect(() => {
    if (!tally) return
    const t = window.setTimeout(() => setTally(null), TALLY_MS)
    return () => window.clearTimeout(t)
  }, [tally])

  useEffect(() => {
    const prev = prevLifeRef.current
    if (rt.life !== prev) {
      const kind = rt.life < prev ? "damage" : "heal"
      setFlash(kind)
      vibrate(kind === "damage" ? 40 : 20)
      prevLifeRef.current = rt.life
      const t = window.setTimeout(() => setFlash(null), 450)
      return () => window.clearTimeout(t)
    }
  }, [rt.life])
  // Normalise any Scryfall size segment to art_crop for seat panel backgrounds
  const art = player.commanderImageUri?.replace(/\/(large|png|normal|small|border_crop)\//, "/art_crop/")
  const hasCommander = !!player.commanderName?.trim()

  const totalCommanderDmg = commanderSources?.reduce((sum, s) => sum + s.amount, 0) ?? 0
  const hasDamageInfo = (commanderSources && commanderSources.length > 0) || rt.poison > 0

  return (
    <div
      data-seat-id={player.id}
      style={{ backgroundColor: rt.knockedOut ? undefined : (SEAT_COLORS[player.seatPosition] ?? "#64748B") }}
      className={cn(
        "relative h-full w-full select-none overflow-hidden text-white transition-shadow",
        rt.knockedOut && "bg-muted",
        dragTarget && "ring-4 ring-inset ring-white",
        isActive && !dragTarget && "ring-4 ring-inset ring-white/70",
        rollHighlight === "picked" && "ring-[6px] ring-inset ring-white animate-pulse"
      )}
    >
      {/* commander art + legibility scrim */}
      {art && !rt.knockedOut && !artFailed && (
        <>
          <img
            src={art}
            onError={() => setArtFailed(true)}
            className="absolute inset-0 h-full w-full object-cover object-center"
            alt=""
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/60" />
        </>
      )}

      {rt.knockedOut ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <Skull className="h-9 w-9" />
          <KnockoutControl rt={rt} onRevive={onRevive} onKnockout={onKnockout} />
        </div>
      ) : preGame ? (
        /* Pre-game: no life / no attack — just name, commander, and swap grip. */
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-3 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          <span className="max-w-[94%] truncate text-[clamp(1.1rem,4.5vmin,1.8rem)] font-bold uppercase tracking-wide text-white">
            {player.displayName}
          </span>
          {hasCommander ? (
            <button
              onClick={onSetCommander}
              className="flex max-w-[94%] items-center gap-1.5 rounded-full bg-black/35 px-4 py-2 text-[clamp(0.75rem,2.4vmin,1rem)] font-semibold text-white active:scale-95"
            >
              <span className="truncate">{player.commanderName}</span>
              <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>
          ) : (
            <button
              onClick={onSetCommander}
              className="flex items-center gap-1.5 rounded-full border-2 border-dashed border-white/70 bg-black/30 px-4 py-2 text-[clamp(0.75rem,2.4vmin,1rem)] font-extrabold uppercase tracking-wider text-white active:scale-95"
            >
              <Plus className="h-4 w-4" /> {copy.live.board.setCommander}
            </button>
          )}
          {swapSlot}
        </div>
      ) : (
        <>
          {/* attack / + commander near the INNER edge (panel top) — short drag
              to the other seats clustered around the centre, with breathing room
              from the seam */}
          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
            {hasCommander ? (
              attackSlot
            ) : (
              <button
                onClick={onSetCommander}
                className="flex h-9 items-center gap-1.5 rounded-full border-2 border-dashed border-white/60 bg-black/30 px-3.5 text-[11px] font-extrabold uppercase tracking-wider text-white active:scale-95"
              >
                <Plus className="h-4 w-4" /> {copy.live.board.commander}
              </button>
            )}
          </div>

          {/* life — centred, nudged inward on side seats to clear the edge control */}
          <div
            style={{ transform: side ? "translateY(-13%)" : undefined }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
          >
            <span className="max-w-[90%] truncate text-[clamp(0.7rem,2.4vmin,1.1rem)] font-bold uppercase tracking-wide text-white/85">
              {player.displayName}
            </span>
            {hasCommander && (
              <span className="-mt-0.5 max-w-[92%] truncate text-[clamp(0.55rem,1.7vmin,0.8rem)] font-medium text-white/65">
                {player.commanderName}
              </span>
            )}

            <div className="relative flex items-center gap-3">
              {tally && tally.amount !== 0 && (
                <span
                  key={tally.seq}
                  data-testid="life-tally"
                  className={cn(
                    "pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 -translate-y-full rounded-full px-3 py-1 text-[clamp(1rem,3.6vmin,1.6rem)] font-black tabular-nums shadow-lg animate-life-tally",
                    tally.amount < 0 ? "bg-red-600/90 text-white" : "bg-emerald-600/90 text-white",
                  )}
                >
                  {tally.amount > 0 ? `+${tally.amount}` : tally.amount}
                </span>
              )}
              <HoldStepButton
                onStep={stepLife}
                shortDelta={1}
                longDelta={10}
                ariaLabel={copy.live.board.loseLifeLabel}
                className="flex h-16 w-16 touch-none items-center justify-center rounded-full bg-black/25 text-white active:scale-95"
              >
                <Minus className="h-7 w-7" />
              </HoldStepButton>
              <span
                key={flash}
                style={{ fontSize: "clamp(3rem, 12vmin, 7.5rem)" }}
                className={cn(
                  "tabular-nums font-black leading-none",
                  rt.life <= 5 && "text-red-300",
                  flash === "damage" && "animate-life-damage text-red-300",
                  flash === "heal" && "animate-life-heal text-emerald-300",
                )}
              >
                {rt.life}
              </span>
              <HoldStepButton
                onStep={stepLife}
                shortDelta={-1}
                longDelta={-10}
                ariaLabel={copy.live.board.gainLifeLabel}
                className="flex h-16 w-16 touch-none items-center justify-center rounded-full bg-black/25 text-white active:scale-95"
              >
                <Plus className="h-7 w-7" />
              </HoldStepButton>
            </div>

            {hasDamageInfo && (
              <button
                onClick={() => onShowDamage?.()}
                aria-label={copy.live.board.viewDamageLabel}
                className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[11px] font-bold text-white/90 active:scale-95"
              >
                {totalCommanderDmg > 0 && (
                  <span className={cn(commanderSources?.some((s) => s.amount >= LETHAL_COMMANDER) && "text-red-300")}>
                    ⚔ {totalCommanderDmg}
                  </span>
                )}
                {rt.poison > 0 && (
                  <span className={cn(rt.poison >= LETHAL_POISON ? "text-green-300" : "text-white/90")}>
                    {totalCommanderDmg > 0 ? "· " : ""}☠ {rt.poison}
                  </span>
                )}
                <span className="text-white/50">›</span>
              </button>
            )}
          </div>

          <div className="absolute right-1 top-1 z-20">
            <KnockoutControl rt={rt} onRevive={onRevive} onKnockout={onKnockout} />
          </div>
        </>
      )}

      {dragTarget && preview && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="rounded-full bg-destructive px-3 py-1 text-3xl font-black text-destructive-foreground shadow-lg">
            {preview}
          </span>
        </div>
      )}

      {rollHighlight === "picked" && (
        <div className="pointer-events-none absolute inset-0 z-30 bg-white/25 animate-pulse" />
      )}

      {rollHighlight && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)] transition-all",
              rollHighlight === "picked"
                ? "scale-125 px-8 py-6 bg-white/30 shadow-2xl ring-[6px] ring-white animate-pulse"
                : "px-6 py-5 bg-black/35"
            )}
          >
            {rollHighlight === "picked" ? (
              <>
                <Crown className="h-16 w-16 drop-shadow-lg" />
                <span className="text-2xl font-black uppercase tracking-wider">{copy.live.board.startsHere}</span>
              </>
            ) : (
              <Dices className="h-9 w-9 animate-spin" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Knockout / revive affordance shown inside a seat ---- */
export function KnockoutControl({
  rt,
  onRevive,
  onKnockout,
  compact,
}: {
  rt: PlayerRuntime
  onRevive: () => void
  onKnockout: () => void
  compact?: boolean
}) {
  if (rt.knockedOut) {
    return (
      <Button
        size={compact ? "sm" : "default"}
        variant="secondary"
        onClick={onRevive}
        className="gap-1.5"
      >
        <Heart className="h-4 w-4" /> {copy.live.board.revive}
      </Button>
    )
  }
  return (
    <button
      onClick={onKnockout}
      className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80 hover:bg-destructive hover:text-white transition-colors active:scale-95"
    >
      <Skull className="h-3.5 w-3.5" /> {copy.live.board.knockout}
    </button>
  )
}

/* ---- End-game banner shown when one player remains ---- */
export function EndGameBanner({
  winner,
  onSave,
  onRematch,
  onDiscard,
  saving,
}: {
  winner: LivePlayer | null
  onSave: () => void
  onRematch: () => void
  onDiscard?: () => void
  saving?: boolean
}) {
  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 shadow-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <span className="font-semibold">
          {winner ? copy.live.board.winnerBanner(winner.displayName) : copy.live.board.gameOver}
        </span>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} className="flex-1 gap-1.5">
          <Save className="h-4 w-4" /> {copy.live.board.saveGame}
        </Button>
        <Button onClick={onRematch} variant="outline" className="flex-1 gap-1.5">
          <RotateCcw className="h-4 w-4" /> {copy.live.board.rematch}
        </Button>
      </div>
      {onDiscard && (
        <Button onClick={onDiscard} variant="ghost" className="w-full gap-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> {copy.live.board.discardGame}
        </Button>
      )}
    </div>
  )
}

/* ---- Full commander + poison damage breakdown for one player ---- */
export function DamageModal({
  player,
  commanderSources,
  poison,
  onClose,
}: {
  player: LivePlayer
  commanderSources: Array<{ name: string; amount: number }>
  poison: number
  onClose: () => void
}) {
  const hasAny = commanderSources.length > 0 || poison > 0
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-[min(88vw,22rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-sm">{player.displayName}</p>
            <p className="text-xs text-muted-foreground">{copy.live.damageModal.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {!hasAny && (
            <p className="py-4 text-center text-sm text-muted-foreground">{copy.live.damageModal.empty}</p>
          )}

          {commanderSources.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{copy.live.damageModal.commanderDamage}</p>
              {commanderSources.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span className="truncate font-medium">⚔ {s.name}</span>
                  <span className={cn("shrink-0 tabular-nums font-bold", s.amount >= LETHAL_COMMANDER ? "text-destructive" : "text-foreground")}>
                    {s.amount} / {LETHAL_COMMANDER}
                  </span>
                </div>
              ))}
            </div>
          )}

          {poison > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{copy.live.damageModal.poison}</p>
              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="font-medium">{copy.live.damageModal.poisonCounters}</span>
                <span className={cn("tabular-nums font-bold", poison >= LETHAL_POISON ? "text-green-600 dark:text-green-400" : "text-foreground")}>
                  {poison} / {LETHAL_POISON}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
