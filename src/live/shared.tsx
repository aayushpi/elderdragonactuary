import { type ReactNode, useEffect, useRef, useState } from "react"
import { Trophy, RotateCcw, Save, Skull, Heart, Minus, Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LETHAL_COMMANDER, LETHAL_POISON, SEAT_COLORS, type DamageView, type LivePlayer, type PlayerRuntime } from "./engine"
import type { DragInfo } from "./drag"

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


function vibrate(ms: number) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
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
  damageView,
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
  /** how to display commander / poison damage */
  damageView?: DamageView
}) {
  const prevLifeRef = useRef(rt.life)
  const [flash, setFlash] = useState<"damage" | "heal" | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [chipExpanded, setChipExpanded] = useState(false)
  const [artFailed, setArtFailed] = useState(false)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)

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

  function onSwipeStart(e: React.PointerEvent) {
    if (damageView !== "flip") return
    swipeStartX.current = e.clientX
    swipeStartY.current = e.clientY
  }
  function onSwipeEnd(e: React.PointerEvent) {
    if (damageView !== "flip") return
    const dx = e.clientX - swipeStartX.current
    const dy = e.clientY - swipeStartY.current
    if (Math.abs(dx) > 55 && Math.abs(dy) < 50) setFlipped(dx < 0)
  }

  // Full damage breakdown (used in flip face and chip expanded)
  function DamageBreakdown() {
    return (
      <div className="flex flex-col items-center gap-0.5 text-[clamp(0.6rem,2vmin,0.85rem)] font-bold">
        {commanderSources && commanderSources.length > 0 ? (
          commanderSources.map((s) => (
            <span key={s.name} className={cn(s.amount >= LETHAL_COMMANDER ? "text-red-300" : "text-white/90")}>
              ⚔ {s.name} {s.amount}/{LETHAL_COMMANDER}
            </span>
          ))
        ) : null}
        {rt.poison > 0 && (
          <span className={cn(rt.poison >= LETHAL_POISON ? "text-green-300" : "text-white/90")}>
            ☠ Poison {rt.poison}/{LETHAL_POISON}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      data-seat-id={player.id}
      style={{ backgroundColor: rt.knockedOut ? undefined : (SEAT_COLORS[player.seatPosition] ?? "#64748B") }}
      className={cn(
        "relative h-full w-full select-none overflow-hidden text-white transition-shadow",
        rt.knockedOut && "bg-muted",
        dragTarget && "ring-4 ring-inset ring-white",
        isActive && !dragTarget && "ring-4 ring-inset ring-white/70"
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
              <Plus className="h-4 w-4" /> Set commander
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
                <Plus className="h-4 w-4" /> Commander
              </button>
            )}
          </div>

          {/* life — centred, nudged inward on side seats to clear the edge control */}
          <div
            style={{ transform: side ? "translateY(-13%)" : undefined }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
            onPointerDown={onSwipeStart}
            onPointerUp={onSwipeEnd}
          >
            <span className="max-w-[90%] truncate text-[clamp(0.7rem,2.4vmin,1.1rem)] font-bold uppercase tracking-wide text-white/85">
              {player.displayName}
            </span>
            {hasCommander && !flipped && (
              <span className="-mt-0.5 max-w-[92%] truncate text-[clamp(0.55rem,1.7vmin,0.8rem)] font-medium text-white/65">
                {player.commanderName}
              </span>
            )}

            {/* Flip variant — damage face */}
            {damageView === "flip" && flipped ? (
              <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Damage taken</span>
                <DamageBreakdown />
                {!hasDamageInfo && (
                  <span className="text-[clamp(0.65rem,2vmin,0.85rem)] text-white/50">None yet</span>
                )}
                <span className="mt-1 text-[9px] font-mono text-white/35">swipe right to return</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { vibrate(25); onSelfChange(1) }}
                    aria-label="lose 1 life"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/25 text-white active:scale-95 disabled:opacity-30"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
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
                  <button
                    onClick={() => { vibrate(15); onSelfChange(-1) }}
                    aria-label="gain 1 life"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/25 text-white active:scale-95 disabled:opacity-30"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {/* Damage display — variant specific */}
                {damageView === "flip" && hasDamageInfo && (
                  <span className="text-[9px] font-mono text-white/40">← swipe to see damage</span>
                )}

                {damageView === "chip" && hasDamageInfo && (
                  chipExpanded ? (
                    <div className="flex flex-col items-center gap-1">
                      <DamageBreakdown />
                      <button
                        onClick={(e) => { e.stopPropagation(); setChipExpanded(false) }}
                        className="mt-0.5 text-[9px] font-mono text-white/40 active:scale-95"
                      >
                        ‹ less
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setChipExpanded(true) }}
                      className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[11px] font-bold text-white/90 active:scale-95"
                    >
                      {totalCommanderDmg > 0 && <span>⚔ {totalCommanderDmg}</span>}
                      {rt.poison > 0 && <span>{totalCommanderDmg > 0 ? " · " : ""}☠ {rt.poison}</span>}
                      <span className="text-white/50"> ›</span>
                    </button>
                  )
                )}

                {/* Default inline damage (no variant or strip) */}
                {(!damageView || damageView === "strip") && (
                  <>
                    {commanderSources && commanderSources.length > 0 && (
                      <div className="flex flex-col items-center gap-0.5 text-[clamp(0.55rem,1.7vmin,0.8rem)] font-bold">
                        {commanderSources.map((s) => (
                          <span
                            key={s.name}
                            className={cn(s.amount >= LETHAL_COMMANDER ? "text-red-300" : "text-white/75")}
                          >
                            ⚔ {s.name} {s.amount}/{LETHAL_COMMANDER}
                          </span>
                        ))}
                      </div>
                    )}
                    {(!commanderSources || commanderSources.length === 0) && Object.keys(rt.commanderFrom).length > 0 && (
                      <div className="flex items-center gap-2 text-[clamp(0.6rem,1.9vmin,0.9rem)] font-bold">
                        {Object.values(rt.commanderFrom).some(v => v > 0) && (
                          <span className={cn(Math.max(0, ...Object.values(rt.commanderFrom)) >= LETHAL_COMMANDER ? "text-red-300" : "text-white/80")}>
                            ⚔ {Math.max(0, ...Object.values(rt.commanderFrom))}/{LETHAL_COMMANDER}
                          </span>
                        )}
                      </div>
                    )}
                    {rt.poison > 0 && (
                      <div className="text-[clamp(0.6rem,1.9vmin,0.9rem)] font-bold">
                        <span className={cn(rt.poison >= LETHAL_POISON ? "text-green-300" : "text-white/80")}>
                          ☠ {rt.poison}/{LETHAL_POISON}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Strip variant — persistent damage bar at the bottom edge */}
          {damageView === "strip" && hasDamageInfo && (
            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-3 bg-black/50 px-2 py-1 text-[10px] font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              {commanderSources && commanderSources.length > 0
                ? commanderSources.map((s) => (
                    <span key={s.name} className={cn(s.amount >= LETHAL_COMMANDER ? "text-red-300" : "text-white/85")}>
                      ⚔ {s.name.split(" ")[0]} {s.amount}
                    </span>
                  ))
                : null}
              {rt.poison > 0 && (
                <span className={cn(rt.poison >= LETHAL_POISON ? "text-green-300" : "text-white/85")}>
                  ☠ {rt.poison}
                </span>
              )}
            </div>
          )}

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
        <Heart className="h-4 w-4" /> Revive
      </Button>
    )
  }
  return (
    <button
      onClick={onKnockout}
      className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80 hover:bg-destructive hover:text-white transition-colors active:scale-95"
    >
      <Skull className="h-3.5 w-3.5" /> KO
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
    <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <span className="font-semibold">
          {winner ? `${winner.displayName} wins!` : "Game over"}
        </span>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} className="flex-1 gap-1.5">
          <Save className="h-4 w-4" /> Save game
        </Button>
        <Button onClick={onRematch} variant="outline" className="flex-1 gap-1.5">
          <RotateCcw className="h-4 w-4" /> Rematch
        </Button>
      </div>
      {onDiscard && (
        <Button onClick={onDiscard} variant="ghost" className="w-full gap-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Discard game
        </Button>
      )}
    </div>
  )
}
