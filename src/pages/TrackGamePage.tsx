import { useEffect, useRef, useCallback } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import type { Player } from "@/types"
import { useLiveGame } from "@/hooks/useLiveGame"
import { PlayerTile } from "@/components/live/PlayerTile"
import { TurnHub } from "@/components/live/TurnHub"
import { DamageSheet } from "@/components/live/DamageSheet"
import { WinnerOverlay } from "@/components/live/WinnerOverlay"

// ─── Layout ───────────────────────────────────────────────────────────────────
// 6-column × 3-row CSS grid. Row 2 (auto height) holds the Turn Hub.
// Rotations make each tile's content face the player seated at that position.

interface TileLayout {
  gridColumn: string
  gridRow: string
  rotation: number
}

const LAYOUTS: Record<number, TileLayout[]> = {
  2: [
    { gridColumn: "1 / 7", gridRow: "2", rotation: 0 },
    { gridColumn: "1 / 7", gridRow: "1", rotation: 180 },
  ],
  3: [
    { gridColumn: "2 / 6", gridRow: "2", rotation: 0 },
    { gridColumn: "1 / 4", gridRow: "1", rotation: 180 },
    { gridColumn: "4 / 7", gridRow: "1", rotation: 180 },
  ],
  4: [
    { gridColumn: "1 / 4", gridRow: "2", rotation: 0 },
    { gridColumn: "4 / 7", gridRow: "2", rotation: 0 },
    { gridColumn: "4 / 7", gridRow: "1", rotation: 180 },
    { gridColumn: "1 / 4", gridRow: "1", rotation: 180 },
  ],
  5: [
    { gridColumn: "3 / 5", gridRow: "2", rotation: 0 },
    { gridColumn: "5 / 7", gridRow: "2", rotation: 0 },
    { gridColumn: "4 / 7", gridRow: "1", rotation: 180 },
    { gridColumn: "1 / 4", gridRow: "1", rotation: 180 },
    { gridColumn: "1 / 3", gridRow: "2", rotation: 0 },
  ],
}

// Movement threshold before a pointerdown turns into a drag
const DRAG_THRESHOLD_PX = 8

interface TrackGamePageProps {
  players: Partial<Player>[]
  onExit: (result?: { winTurn: number; knockoutTurns: Record<string, number>; winnerId?: string }) => void
  onRematch: () => void
}

export function TrackGamePage({ players: rawPlayers, onExit, onRematch }: TrackGamePageProps) {
  const {
    state,
    adjustDelta,
    applyDamage,
    adjustPoison,
    endTurn,
    openDamageSheet,
    closeDamageSheet,
    updateDamageSheet,
    startDrag,
    updateDrag,
    cancelDrag,
  } = useLiveGame(rawPlayers)

  const { players, currentTurn, activeSeatIndex, turnStartedAt, drag, damageSheet, winnerId, turnLog } = state

  // ── Wake lock ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((l) => { lock = l }).catch(() => {})
    }
    return () => { lock?.release().catch(() => {}) }
  }, [])

  // ── Drag system ────────────────────────────────────────────────────────────
  // We use imperative window-level event listeners so pointer events are never
  // lost to pointer capture or conditional-render timing.

  // All mutable drag bookkeeping lives in a single ref — no stale-closure risk.
  const dragSession = useRef<{
    pointerId: number | null
    playerId: string | null
    startX: number
    startY: number
    live: boolean                    // true once movement threshold crossed
    cleanupListeners: (() => void) | null
  }>({ pointerId: null, playerId: null, startX: 0, startY: 0, live: false, cleanupListeners: null })

  // Stable refs to the latest action callbacks
  const startDragRef  = useRef(startDrag)
  const updateDragRef = useRef(updateDrag)
  const cancelDragRef = useRef(cancelDrag)
  const openSheetRef  = useRef(openDamageSheet)
  useEffect(() => { startDragRef.current  = startDrag  }, [startDrag])
  useEffect(() => { updateDragRef.current = updateDrag  }, [updateDrag])
  useEffect(() => { cancelDragRef.current = cancelDrag  }, [cancelDrag])
  useEffect(() => { openSheetRef.current  = openDamageSheet }, [openDamageSheet])

  // Find the closest tile under the pointer by data-drop-target attribute.
  // elementsFromPoint returns all elements at (x,y) front-to-back, so we scan
  // through to find the first one tagged as a drop target.
  const findDropTarget = useCallback((x: number, y: number): string | null => {
    const els = document.elementsFromPoint(x, y)
    for (const el of els) {
      const id = (el as HTMLElement).dataset.dropTarget
      if (id) return id
    }
    return null
  }, [])

  const handleAvatarPointerDown = useCallback(
    (e: React.PointerEvent, playerId: string) => {
      const player = players.find((p) => p.id === playerId)
      if (player?.isEliminated || drag) return

      // Prevent text selection / default browser drag during the gesture
      e.preventDefault()

      const session = dragSession.current
      // Clean up any previous session that didn't finish properly
      session.cleanupListeners?.()

      session.pointerId = e.pointerId
      session.playerId  = playerId
      session.startX    = e.clientX
      session.startY    = e.clientY
      session.live      = false

      function onMove(ev: PointerEvent) {
        if (ev.pointerId !== dragSession.current.pointerId) return
        const ds = dragSession.current

        if (!ds.live) {
          const dist = Math.hypot(ev.clientX - ds.startX, ev.clientY - ds.startY)
          if (dist < DRAG_THRESHOLD_PX) return
          // Crossed threshold — activate drag
          ds.live = true
          startDragRef.current(ds.playerId!, ev.clientX, ev.clientY)
        }

        const hovered = findDropTarget(ev.clientX, ev.clientY)
        // Don't report the source tile as a hover target
        const target = hovered === ds.playerId ? null : hovered
        updateDragRef.current(ev.clientX, ev.clientY, target)
      }

      function onUp(ev: PointerEvent) {
        if (ev.pointerId !== dragSession.current.pointerId) return
        cleanup()

        const ds = dragSession.current
        const wasLive  = ds.live
        const sourceId = ds.playerId!

        // Reset session
        ds.pointerId = null
        ds.playerId  = null
        ds.live      = false

        if (!wasLive) return

        const targetId = findDropTarget(ev.clientX, ev.clientY)
        if (targetId && targetId !== sourceId) {
          openSheetRef.current(sourceId, targetId)
        } else {
          cancelDragRef.current()
        }
      }

      function onCancel() {
        cleanup()
        dragSession.current.pointerId = null
        dragSession.current.playerId  = null
        dragSession.current.live      = false
        cancelDragRef.current()
      }

      function cleanup() {
        window.removeEventListener("pointermove",   onMove)
        window.removeEventListener("pointerup",     onUp)
        window.removeEventListener("pointercancel", onCancel)
        dragSession.current.cleanupListeners = null
      }

      session.cleanupListeners = cleanup
      window.addEventListener("pointermove",   onMove,   { passive: true })
      window.addEventListener("pointerup",     onUp)
      window.addEventListener("pointercancel", onCancel)
    },
    [players, drag, findDropTarget]
  )

  // Cleanup listeners if the component unmounts mid-drag
  useEffect(() => {
    return () => { dragSession.current.cleanupListeners?.() }
  }, [])

  // ── Elimination toasts ────────────────────────────────────────────────────

  const prevEliminatedIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const p of players) {
      if (p.isEliminated && !prevEliminatedIds.current.has(p.id)) {
        prevEliminatedIds.current.add(p.id)
        const cause =
          p.eliminationCause === "commanderDamage" ? "commander damage"
          : p.eliminationCause === "poison" ? "poison counters"
          : "life total"
        toast.error(
          `${p.displayName || p.commanderName} eliminated by ${cause} (T${p.eliminatedOnTurn ?? currentTurn})`,
          { duration: 4000 }
        )
      }
    }
  }, [players, currentTurn])

  // ── Exit / save ───────────────────────────────────────────────────────────

  function handleSaveExit() {
    const knockoutTurns: Record<string, number> = {}
    for (const p of players) {
      if (p.eliminatedOnTurn !== undefined) knockoutTurns[p.id] = p.eliminatedOnTurn
    }
    onExit({ winTurn: currentTurn, knockoutTurns, winnerId: winnerId ?? undefined })
  }

  function handleDiscard() {
    if (!confirm("Discard this game session?")) return
    onExit()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const playerCount = Math.min(players.length, 5) as 2 | 3 | 4 | 5
  const layouts = LAYOUTS[playerCount] ?? LAYOUTS[4]
  const winner = winnerId ? players.find((p) => p.id === winnerId) : null

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950 overflow-hidden touch-none select-none">
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />

      {/* Exit button */}
      {!winnerId && (
        <button
          onClick={handleDiscard}
          className="absolute top-3 right-3 z-[65] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-gray-400 text-xs hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          End game
        </button>
      )}

      {/* Board — two equal rows, tiles fill all screen space */}
      <div
        className="w-full h-full grid gap-1.5 p-1.5"
        style={{
          gridTemplateColumns: "repeat(6, 1fr)",
          gridTemplateRows: "1fr 1fr",
        }}
      >
        {players.map((player, idx) => {
          const layout = layouts[idx]
          if (!layout) return null
          return (
            <div
              key={player.id}
              // data-drop-target is always present so elementsFromPoint finds it
              data-drop-target={player.id}
              style={{ gridColumn: layout.gridColumn, gridRow: layout.gridRow }}
              className="min-w-0 min-h-0"
            >
              <PlayerTile
                player={player}
                playerIndex={idx}
                rotation={layout.rotation}
                isActive={idx === activeSeatIndex && !winnerId}
                isDragActive={!!drag}
                isDragSource={drag?.sourcePlayerId === player.id}
                isDropTarget={drag?.hoveredTargetId === player.id}
                allPlayers={players}
                onAdjustDelta={(delta) => adjustDelta(player.id, delta)}
                onAvatarPointerDown={(e) => handleAvatarPointerDown(e, player.id)}
                onAdjustPoison={(delta) => adjustPoison(player.id, delta)}
              />
            </div>
          )
        })}
      </div>

      {/* Turn Hub — floating over the tile intersection */}
      <div className="absolute inset-0 flex items-center justify-center z-[62] pointer-events-none">
        <div className="pointer-events-auto">
          <TurnHub
            currentTurn={currentTurn}
            turnStartedAt={turnStartedAt}
            activeSeatIndex={activeSeatIndex}
            players={players}
            isDragging={!!drag}
            onEndTurn={endTurn}
          />
        </div>
      </div>

      {/* Drag ghost — follows the pointer */}
      {drag && (
        <div
          className="fixed pointer-events-none z-[64] bg-gray-900/90 border border-white/20 text-white text-xs font-semibold rounded-full px-3 py-1.5 shadow-xl"
          style={{
            left: drag.currentX + 14,
            top:  drag.currentY - 20,
          }}
        >
          {players.find((p) => p.id === drag.sourcePlayerId)?.commanderName ?? "?"}
          {drag.hoveredTargetId && (
            <span className="text-red-400 ml-1.5">
              → {players.find((p) => p.id === drag.hoveredTargetId)?.displayName
                ?? players.find((p) => p.id === drag.hoveredTargetId)?.commanderName
                ?? "?"}
            </span>
          )}
        </div>
      )}

      {/* Damage sheet */}
      {damageSheet && (
        <DamageSheet
          sheet={damageSheet}
          players={players}
          onApply={() =>
            applyDamage(
              damageSheet.targetPlayerId,
              damageSheet.sourcePlayerId,
              damageSheet.amount,
              damageSheet.damageType,
              damageSheet.lifelink
            )
          }
          onCancel={closeDamageSheet}
          onUpdateAmount={(amount) => updateDamageSheet({ amount })}
          onUpdateType={(damageType) => updateDamageSheet({ damageType })}
          onUpdateLifelink={(lifelink) => updateDamageSheet({ lifelink })}
        />
      )}

      {/* Winner overlay */}
      {winner && (
        <div className="animate-in fade-in duration-500">
          <WinnerOverlay
            winner={winner}
            players={players}
            turnLog={turnLog}
            startedAt={state.startedAt}
            currentTurn={currentTurn}
            onSave={handleSaveExit}
            onRematch={onRematch}
          />
        </div>
      )}
    </div>
  )
}
