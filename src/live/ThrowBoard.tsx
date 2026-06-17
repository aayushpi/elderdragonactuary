import { type ReactNode, useRef, useState } from "react"
import { Crosshair, GripHorizontal, GripVertical, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { CommanderPicker } from "@/components/CommanderPicker"
import type { CommanderShortlistItem } from "@/lib/shortlist"
import { BoardChrome } from "./BoardChrome"
import { SeatFrame, DragVector } from "./shared"
import { useDragAttack, useDragLock } from "./drag"
import type { DamageOpts, LiveGameApi, LivePlayer } from "./engine"

/* ============================================================================
 * ThrowBoard — "drag from any seat onto any target" core.
 *
 * The gesture captures *direction* (source → target, any time). On drop, a
 * simple +/− stepper sets the amount, with ⚔ Commander / ☠ Poison / ❤ Lifelink
 * modifiers attached to the damage.
 * ==========================================================================*/

export interface PendingHit {
  sourceId: string
  targetId: string
  x: number
  y: number
}

export function ThrowBoard({
  game,
  onSave,
  onRematch,
  onDiscard,
  saving,
  centerExtra,
  recents = [],
  playerDecks = {},
}: {
  game: LiveGameApi
  onSave: () => void
  onRematch: () => void
  onDiscard?: () => void
  saving?: boolean
  centerExtra?: ReactNode
  recents?: CommanderShortlistItem[]
  /** per-player recent decks, keyed by lowercased display name ("you" for me) */
  playerDecks?: Record<string, CommanderShortlistItem[]>
}) {
  const [pending, setPending] = useState<PendingHit | null>(null)
  // seat assigning a commander in-game (upright picker, led by that player's decks)
  const [cmdrSeat, setCmdrSeat] = useState<LivePlayer | null>(null)

  const { drag, start } = useDragAttack({
    onDrop: (sourceId, targetId, point) => setPending({ sourceId, targetId, ...point }),
  })
  useDragLock(!!drag)

  const swappingRef = useRef<string | null>(null)
  const swapTargetRef = useRef<string | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [swapTarget, setSwapTarget] = useState<string | null>(null)

  function startSwap(id: string, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    swappingRef.current = id
    swapTargetRef.current = null
    setSwapping(id)
    setSwapTarget(null)
    const move = (ev: PointerEvent) => {
      const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-seat-cell]")
      const overId = (el as HTMLElement | null)?.getAttribute("data-seat-cell") ?? null
      const next = overId !== swappingRef.current ? overId : null
      if (next !== swapTargetRef.current) {
        swapTargetRef.current = next
        setSwapTarget(next)
      }
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      const srcId = swappingRef.current
      const tgtId = swapTargetRef.current
      swappingRef.current = null
      swapTargetRef.current = null
      setSwapping(null)
      setSwapTarget(null)
      if (srcId && tgtId) game.swapSeats(srcId, tgtId)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  function apply(amount: number, opts: Pick<DamageOpts, "isCommander" | "isLifelink" | "isPoison">) {
    if (!pending) return
    try { navigator.vibrate?.(opts.isPoison ? 60 : 40) } catch { /* unsupported */ }
    game.applyDamage(pending.targetId, amount, { sourceId: pending.sourceId, ...opts })
    setPending(null)
  }

  function seat(p: LivePlayer, opts: { side: boolean }) {
    const rt = game.runtime[p.id]
    const commanderSources = Object.entries(rt.commanderFrom)
      .filter(([, amt]) => amt > 0)
      .map(([srcId, amt]) => ({
        name: game.players.find((pl) => pl.id === srcId)?.displayName ?? "?",
        amount: amt,
      }))
    return (
      <SeatFrame
        player={p}
        rt={rt}
        isActive={p.seatPosition === game.activeSeat}
        side={opts.side}
        preGame={!game.started}
        dragTarget={drag?.targetId === p.id}
        preview={drag?.targetId === p.id ? "⚔" : null}
        commanderSources={commanderSources.length > 0 ? commanderSources : undefined}
        damageView={game.config.damageView}
        onSelfChange={(d) => game.applyDamage(p.id, d, { sourceId: null })}
        onRevive={() => game.revive(p.id)}
        onKnockout={() => game.toggleKnockout(p.id)}
        onSetCommander={() => setCmdrSeat(p)}
        swapSlot={
          <button
            onPointerDown={(e) => startSwap(p.id, e)}
            aria-label="Drag to swap seat"
            className={cn(
              "mt-1 touch-none flex items-center gap-1.5 rounded-full px-4 py-2 text-[clamp(0.65rem,2vmin,0.8rem)] font-bold uppercase tracking-wide shadow-lg transition-colors active:scale-95",
              swapTarget === p.id
                ? "bg-primary text-primary-foreground"
                : swapping === p.id
                  ? "bg-white/30 text-white"
                  : "bg-black/45 text-white/90"
            )}
          >
            <GripVertical className="h-4 w-4" />
            Drag to swap
          </button>
        }
        attackSlot={
          drag
            ? drag.sourceId === p.id
              ? null
              : <TargetZone armed={drag.targetId === p.id} />
            : <AttackPill onPointerDown={(e) => start(p.id, e, undefined)} />
        }
      />
    )
  }

  function decksFor(p: LivePlayer): CommanderShortlistItem[] {
    return playerDecks[p.displayName.trim().toLowerCase()] ?? recents
  }

  const source = pending ? game.players.find((p) => p.id === pending.sourceId) ?? null : null
  const target = pending ? game.players.find((p) => p.id === pending.targetId) ?? null : null

  return (
    <>
      <BoardChrome
        game={game}
        renderSeat={(p, o) => seat(p, { side: o.side })}
        centerExtra={centerExtra}
        onSave={onSave}
        onRematch={onRematch}
        onDiscard={onDiscard}
        saving={saving}
      />
      <DragVector drag={drag} />

      {pending && source && target && (
        <>
          <div className="fixed inset-0 z-[59]" onClick={() => setPending(null)} />
          <div
            className="fixed z-[60] -translate-x-1/2 rounded-2xl border border-border bg-popover p-3 shadow-2xl"
            style={{
              left: Math.min(window.innerWidth - 130, Math.max(130, pending.x)),
              top: Math.min(window.innerHeight - 250, Math.max(12, pending.y - 24)),
            }}
          >
            <StepperEntry
              key={`${pending.sourceId}-${pending.targetId}-${pending.x}`}
              source={source}
              target={target}
              onApply={apply}
            />
          </div>
        </>
      )}

      {/* in-game commander assignment — upright picker, led by that seat's decks */}
      {cmdrSeat && (
        <CommanderPicker
          open
          onOpenChange={(o) => !o && setCmdrSeat(null)}
          seatLabel={cmdrSeat.displayName}
          label={cmdrSeat.isMe ? "You" : cmdrSeat.displayName}
          value={cmdrSeat.commanderName}
          items={decksFor(cmdrSeat)}
          onPick={(pick) => {
            game.setCommander(cmdrSeat.id, pick)
            setCmdrSeat(null)
          }}
        />
      )}
    </>
  )
}

function TargetZone({ armed }: { armed: boolean }) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-full border-2 border-dashed px-4 text-[11px] font-extrabold uppercase tracking-wider text-white transition-all",
        armed ? "animate-pulse scale-110 border-white bg-white/25" : "border-white/50 bg-black/20"
      )}
    >
      <Crosshair className="h-4 w-4" />
      Target
    </div>
  )
}

/* The weighty, beveled drag grip. */
function AttackPill({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <button
      onPointerDown={onPointerDown}
      className="flex h-10 touch-none items-center gap-1.5 rounded-full px-4 text-[11px] font-extrabold uppercase tracking-wider text-white active:translate-y-px"
      style={{
        background: "linear-gradient(to bottom, #3f3f46, #18181b)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -3px 4px rgba(0,0,0,0.5), 0 3px 6px rgba(0,0,0,0.45)",
      }}
    >
      <GripHorizontal className="h-4 w-4 opacity-80" />
      Attack
    </button>
  )
}

function EntryHeader({ source, target }: { source: LivePlayer; target: LivePlayer }) {
  return (
    <div className="mb-2 text-center text-sm font-semibold">
      <span className="text-foreground">{source.displayName}</span>
      <span className="text-muted-foreground"> → </span>
      <span className="text-destructive">{target.displayName}</span>
    </div>
  )
}

const MODS = [
  { key: "isCommander" as const, label: "⚔ Cmdr" },
  { key: "isPoison" as const, label: "☠ Poison" },
  { key: "isLifelink" as const, label: "❤ Lifelink" },
]

function StepperEntry({
  source,
  target,
  onApply,
}: {
  source: LivePlayer
  target: LivePlayer
  onApply: (amount: number, opts: Pick<DamageOpts, "isCommander" | "isLifelink" | "isPoison">) => void
}) {
  const [value, setValue] = useState(1)
  const [mods, setMods] = useState({ isCommander: false, isPoison: false, isLifelink: false })

  function toggle(key: keyof typeof mods) {
    setMods((m) => {
      const next = { ...m, [key]: !m[key] }
      // poison is its own damage type — it can't also be commander/lifelink
      if (key === "isPoison" && next.isPoison) {
        next.isCommander = false
        next.isLifelink = false
      }
      if ((key === "isCommander" || key === "isLifelink") && next[key]) next.isPoison = false
      return next
    })
  }

  return (
    <div className="w-[15rem]">
      <EntryHeader source={source} target={target} />

      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setValue((v) => Math.max(1, v - 1))}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted active:scale-95"
          aria-label="minus"
        >
          <Minus className="h-7 w-7" />
        </button>
        <span className="min-w-[2.5ch] text-center tabular-nums text-5xl font-black">{value}</span>
        <button
          onClick={() => setValue((v) => Math.min(99, v + 1))}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted active:scale-95"
          aria-label="plus"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {MODS.map((m) => (
          <button
            key={m.key}
            onClick={() => toggle(m.key)}
            className={cn(
              "h-9 rounded-lg text-[11px] font-bold transition-colors",
              mods[m.key]
                ? m.key === "isPoison"
                  ? "bg-green-600 text-white"
                  : m.key === "isLifelink"
                    ? "bg-rose-500 text-white"
                    : "bg-destructive text-destructive-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => onApply(value, mods)}
        className="h-12 w-full rounded-xl bg-destructive text-base font-bold text-destructive-foreground active:scale-95"
      >
        {mods.isPoison ? `Poison ${value}` : `Deal ${value}`}
      </button>
    </div>
  )
}
