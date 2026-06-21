import { type ReactNode, useRef, useState } from "react"
import { Crosshair, GripHorizontal, GripVertical, Minus, Plus, Pencil, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CommanderPicker } from "@/components/CommanderPicker"
import type { CommanderShortlistItem } from "@/lib/shortlist"
import { BoardChrome } from "./BoardChrome"
import { SeatFrame, DragVector, DamageModal, HoldStepButton } from "./shared"
import { useDragAttack, useDragLock } from "./drag"
import { SEAT_COLORS, type DamageOpts, type LiveGameApi, type LivePlayer } from "./engine"

/* Sentinel target id for the centre "Damage all" drop zone — the drag hit-test
 * picks it up like any seat (it carries data-seat-id), but it fans the hit out
 * to every other living player instead of one seat. */
const DAMAGE_ALL_ID = "__damage_all__"

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
  // seat whose full damage breakdown is open
  const [damageSeat, setDamageSeat] = useState<LivePlayer | null>(null)
  // commanders are mandatory before a game can be saved (needed for stats)
  const [showCommanderGate, setShowCommanderGate] = useState(false)

  const missingCommanders = game.players.filter((p) => !p.commanderName?.trim())

  function handleSaveRequest() {
    if (missingCommanders.length > 0) setShowCommanderGate(true)
    else onSave()
  }

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
    if (pending.targetId === DAMAGE_ALL_ID) {
      // Fan out to every living opponent. Each applyDamage call is independent,
      // so commander damage, poison, and lifelink (one heal per hit) all tally
      // correctly per target.
      for (const p of game.players) {
        if (p.id === pending.sourceId || game.runtime[p.id]?.knockedOut) continue
        game.applyDamage(p.id, amount, { sourceId: pending.sourceId, ...opts })
      }
    } else {
      game.applyDamage(pending.targetId, amount, { sourceId: pending.sourceId, ...opts })
    }
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
        onShowDamage={() => setDamageSeat(p)}
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

  const pendingAll = pending?.targetId === DAMAGE_ALL_ID
  const source = pending ? game.players.find((p) => p.id === pending.sourceId) ?? null : null
  const target = pending && !pendingAll ? game.players.find((p) => p.id === pending.targetId) ?? null : null

  return (
    <>
      <BoardChrome
        game={game}
        renderSeat={(p, o) => seat(p, { side: o.side })}
        centerExtra={centerExtra}
        onSave={handleSaveRequest}
        onRematch={onRematch}
        onDiscard={onDiscard}
        saving={saving}
      />
      <DragVector drag={drag} />

      {/* Centre "Damage all" drop zone — only present while an attack is in flight */}
      {drag && (
        <div
          data-seat-id={DAMAGE_ALL_ID}
          className={cn(
            "fixed left-1/2 top-1/2 z-[56] flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center justify-center gap-1 rounded-full border-2 text-center text-white transition-all",
            drag.targetId === DAMAGE_ALL_ID
              ? "scale-110 animate-pulse border-white bg-destructive/85 shadow-2xl"
              : "border-dashed border-white/60 bg-black/55"
          )}
        >
          <Swords className="h-7 w-7" />
          <span className="text-[11px] font-extrabold uppercase leading-tight tracking-wide">
            Damage<br />all
          </span>
        </div>
      )}

      {pending && source && (pendingAll || target) && (
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
              sourceName={source.displayName}
              targetName={pendingAll ? "All players" : target?.displayName ?? "?"}
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

      {damageSeat && (
        <DamageModal
          player={damageSeat}
          commanderSources={Object.entries(game.runtime[damageSeat.id]?.commanderFrom ?? {})
            .filter(([, amt]) => amt > 0)
            .map(([srcId, amt]) => ({
              name: game.players.find((pl) => pl.id === srcId)?.displayName ?? "?",
              amount: amt,
            }))}
          poison={game.runtime[damageSeat.id]?.poison ?? 0}
          onClose={() => setDamageSeat(null)}
        />
      )}

      {showCommanderGate && (
        <div className="fixed inset-0 z-[64] flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Set commanders to save</p>
              <p className="text-xs text-muted-foreground">
                Every player needs a commander so the game counts toward stats.
              </p>
            </div>
            <div className="max-h-[55vh] divide-y divide-border overflow-y-auto">
              {[...game.players]
                .sort((a, b) => a.seatPosition - b.seatPosition)
                .map((p) => {
                  const has = !!p.commanderName?.trim()
                  return (
                    <button
                      key={p.id}
                      onClick={() => setCmdrSeat(p)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SEAT_COLORS[p.seatPosition] ?? "#64748B" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{p.displayName}</div>
                        <div className={cn("truncate text-xs", has ? "text-muted-foreground" : "text-destructive")}>
                          {has ? p.commanderName : "No commander — tap to set"}
                        </div>
                      </div>
                      {has ? (
                        <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                    </button>
                  )
                })}
            </div>
            <div className="flex gap-2 border-t p-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCommanderGate(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={missingCommanders.length > 0}
                onClick={() => { setShowCommanderGate(false); onSave() }}
              >
                {missingCommanders.length > 0
                  ? `${missingCommanders.length} missing`
                  : "Save game"}
              </Button>
            </div>
          </div>
        </div>
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

function EntryHeader({ sourceName, targetName }: { sourceName: string; targetName: string }) {
  return (
    <div className="mb-2 text-center text-sm font-semibold">
      <span className="text-foreground">{sourceName}</span>
      <span className="text-muted-foreground"> → </span>
      <span className="text-destructive">{targetName}</span>
    </div>
  )
}

const MODS = [
  { key: "isCommander" as const, label: "⚔ Cmdr" },
  { key: "isPoison" as const, label: "☠ Poison" },
  { key: "isLifelink" as const, label: "❤ Lifelink" },
]

function StepperEntry({
  sourceName,
  targetName,
  onApply,
}: {
  sourceName: string
  targetName: string
  onApply: (amount: number, opts: Pick<DamageOpts, "isCommander" | "isLifelink" | "isPoison">) => void
}) {
  const [value, setValue] = useState(1)
  const [mods, setMods] = useState({ isCommander: false, isPoison: false, isLifelink: false })

  function toggle(key: keyof typeof mods) {
    setMods((m) => ({ ...m, [key]: !m[key] }))
  }

  return (
    <div className="w-[15rem]">
      <EntryHeader sourceName={sourceName} targetName={targetName} />

      <div className="mb-3 flex items-center justify-between gap-2">
        <HoldStepButton
          onStep={(d) => setValue((v) => Math.max(1, v + d))}
          shortDelta={-1}
          longDelta={-10}
          ariaLabel="minus (hold for 10)"
          className="flex h-14 w-14 touch-none items-center justify-center rounded-2xl bg-muted active:scale-95"
        >
          <Minus className="h-7 w-7" />
        </HoldStepButton>
        <span className="min-w-[2.5ch] text-center tabular-nums text-5xl font-black">{value}</span>
        <HoldStepButton
          onStep={(d) => setValue((v) => Math.min(99, v + d))}
          shortDelta={1}
          longDelta={10}
          ariaLabel="plus (hold for 10)"
          className="flex h-14 w-14 touch-none items-center justify-center rounded-2xl bg-muted active:scale-95"
        >
          <Plus className="h-7 w-7" />
        </HoldStepButton>
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
