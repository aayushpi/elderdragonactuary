import { useEffect, useRef, useCallback, useState } from "react"
import { toast } from "sonner"
import type { Player } from "@/types"
import { useLiveGame } from "@/hooks/useLiveGame"
import { PlayerTile, playerColor } from "@/components/live/PlayerTile"
import { cn } from "@/lib/utils"
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

  const { players, currentTurn, activeSeatIndex, turnStartedAt, drag, damageSheet, winnerId } = state

  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false)

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

      {/* Board — two equal rows; hub floats above the inner edges */}
      <div
        className="w-full h-full grid"
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

      {/* Turn Hub — floats over the inner tile edges */}
      <div className="absolute inset-0 flex items-center justify-center z-[62] pointer-events-none">
        <div className="pointer-events-auto">
          <TurnHub
            currentTurn={currentTurn}
            turnStartedAt={turnStartedAt}
            activeSeatIndex={activeSeatIndex}
            players={players}
            isDragging={!!drag}
            onEndTurn={endTurn}
            onEndGame={() => setShowEndGameConfirm(true)}
          />
        </div>
      </div>

      {/* Drag ghost — circular avatar follows the pointer */}
      {drag && (() => {
        const dragIdx   = players.findIndex((p) => p.id === drag.sourcePlayerId)
        const dragPlayer = players[dragIdx]
        const color     = playerColor(dragIdx)
        const target    = drag.hoveredTargetId ? players.find((p) => p.id === drag.hoveredTargetId) : null
        return (
          <div
            className="fixed pointer-events-none z-[64] flex flex-col items-center gap-1.5"
            style={{ left: drag.currentX, top: drag.currentY, transform: "translate(-50%, -50%)" }}
          >
            <div
              className={cn("rounded-full overflow-hidden border-2 shadow-2xl", color.border)}
              style={{ width: 64, height: 64 }}
            >
              {dragPlayer?.commanderImageUri ? (
                <img src={dragPlayer.commanderImageUri} alt="" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className={cn("w-full h-full flex items-center justify-center", color.bg)}>
                  <span className="text-xl font-bold text-white/60">
                    {dragPlayer?.commanderName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {target && (
              <div className="bg-red-900/90 text-red-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-red-500/30 whitespace-nowrap">
                {dragPlayer?.displayName ?? dragPlayer?.commanderName} attacking → {target.displayName ?? target.commanderName}
              </div>
            )}
          </div>
        )
      })()}

      {/* End Game confirmation */}
      {showEndGameConfirm && !winnerId && (
        <div className="absolute inset-0 z-[66] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col gap-3 min-w-[200px] shadow-2xl">
            <p className="text-white font-bold text-center text-base">End Game?</p>
            <button
              onClick={() => { setShowEndGameConfirm(false); handleSaveExit() }}
              className="w-full py-2.5 rounded-xl bg-white text-gray-900 font-bold text-sm hover:bg-gray-100 active:scale-95 transition-all"
            >
              Save Game
            </button>
            <button
              onClick={() => { setShowEndGameConfirm(false); handleDiscard() }}
              className="w-full py-2.5 rounded-xl bg-red-900/50 border border-red-500/30 text-red-300 font-semibold text-sm hover:bg-red-900/70 active:scale-95 transition-all"
            >
              Discard Game
            </button>
            <button
              onClick={() => setShowEndGameConfirm(false)}
              className="text-gray-500 text-xs text-center hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
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
