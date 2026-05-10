import { useEffect, useRef, useCallback, useState } from "react"
import { toast } from "sonner"
import type { Player, RecentCommander, SeatPosition } from "@/types"
import { useLiveGame } from "@/hooks/useLiveGame"
import { PlayerTile, playerColor } from "@/components/live/PlayerTile"
import { cn } from "@/lib/utils"
import { TurnHub } from "@/components/live/TurnHub"
import { DamageSheet } from "@/components/live/DamageSheet"
import { WinnerOverlay } from "@/components/live/WinnerOverlay"
import { CommanderEditModal } from "@/components/live/CommanderEditModal"

// ─── Layout ───────────────────────────────────────────────────────────────────
// 6-column × 2-row CSS grid. Rotations make each tile face the seated player.

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
    { gridColumn: "4 / 7", gridRow: "1", rotation: 180 },
    { gridColumn: "1 / 4", gridRow: "1", rotation: 180 },
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
  6: [
    { gridColumn: "1 / 3", gridRow: "2", rotation: 0 },
    { gridColumn: "3 / 5", gridRow: "2", rotation: 0 },
    { gridColumn: "5 / 7", gridRow: "2", rotation: 0 },
    { gridColumn: "5 / 7", gridRow: "1", rotation: 180 },
    { gridColumn: "3 / 5", gridRow: "1", rotation: 180 },
    { gridColumn: "1 / 3", gridRow: "1", rotation: 180 },
  ],
}

const DRAG_THRESHOLD_PX = 8

interface ExitResult {
  winTurn: number
  knockoutTurns: Record<string, number>
  winnerId?: string
  players: Partial<Player>[]
}

interface TrackGamePageProps {
  players: Partial<Player>[]
  onExit: (result?: ExitResult) => void
  onRematch: (players: Partial<Player>[]) => void
  onSaveAndRematch: (result: ExitResult, rematchPlayers: Partial<Player>[]) => void
  knownPlayerNames: string[]
  recentMyCommanders: RecentCommander[]
  myDisplayName?: string
}

export function TrackGamePage({ players: rawPlayers, onExit, onRematch, onSaveAndRematch, knownPlayerNames, recentMyCommanders, myDisplayName }: TrackGamePageProps) {
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
    updatePlayer,
    swapSeats,
    startGame,
  } = useLiveGame(rawPlayers)

  const { players, currentTurn, activeSeatIndex, turnStartedAt, drag, damageSheet, winnerId } = state

  const [phase, setPhase] = useState<"setup" | "active">("setup")
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [setupDrag, setSetupDrag] = useState<{ sourceId: string; hoveredId: string | null; currentX: number; currentY: number } | null>(null)
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false)
  const [pickingWinnerForRematch, setPickingWinnerForRematch] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [rolls, setRolls] = useState<Record<string, number>>({})

  // ── Landscape lock ────────────────────────────────────────────────────────

  useEffect(() => {
    const ori = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    ori.lock?.("landscape").catch(() => {})
    return () => {
      const u = screen.orientation as ScreenOrientation & { unlock?: () => void }
      u.unlock?.()
    }
  }, [])

  // ── Wake lock ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((l) => { lock = l }).catch(() => {})
    }
    return () => { lock?.release().catch(() => {}) }
  }, [])

  // ── Drag system ────────────────────────────────────────────────────────────

  const dragSession = useRef<{
    pointerId: number | null
    playerId: string | null
    startX: number
    startY: number
    live: boolean
    cleanupListeners: (() => void) | null
  }>({ pointerId: null, playerId: null, startX: 0, startY: 0, live: false, cleanupListeners: null })

  const startDragRef  = useRef(startDrag)
  const updateDragRef = useRef(updateDrag)
  const cancelDragRef = useRef(cancelDrag)
  const openSheetRef  = useRef(openDamageSheet)
  useEffect(() => { startDragRef.current  = startDrag  }, [startDrag])
  useEffect(() => { updateDragRef.current = updateDrag  }, [updateDrag])
  useEffect(() => { cancelDragRef.current = cancelDrag  }, [cancelDrag])
  useEffect(() => { openSheetRef.current  = openDamageSheet }, [openDamageSheet])

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

      e.preventDefault()

      const session = dragSession.current
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
          ds.live = true
          startDragRef.current(ds.playerId!, ev.clientX, ev.clientY)
        }

        const hovered = findDropTarget(ev.clientX, ev.clientY)
        const target = hovered === ds.playerId ? null : hovered
        updateDragRef.current(ev.clientX, ev.clientY, target)
      }

      function onUp(ev: PointerEvent) {
        if (ev.pointerId !== dragSession.current.pointerId) return
        cleanup()

        const ds = dragSession.current
        const wasLive  = ds.live
        const sourceId = ds.playerId!

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

  useEffect(() => {
    return () => { dragSession.current.cleanupListeners?.() }
  }, [])

  // ── Setup drag (seat swap) ─────────────────────────────────────────────────

  const handleSetupTilePointerDown = useCallback(
    (e: React.PointerEvent, playerId: string) => {
      if (dragSession.current.pointerId !== null) return

      const session = dragSession.current
      session.cleanupListeners?.()
      session.pointerId = e.pointerId
      session.playerId = playerId
      session.startX = e.clientX
      session.startY = e.clientY
      session.live = false

      function onMove(ev: PointerEvent) {
        if (ev.pointerId !== dragSession.current.pointerId) return
        const ds = dragSession.current
        if (!ds.live) {
          if (Math.hypot(ev.clientX - ds.startX, ev.clientY - ds.startY) < DRAG_THRESHOLD_PX) return
          ds.live = true
        }
        const hovered = findDropTarget(ev.clientX, ev.clientY)
        setSetupDrag({ sourceId: playerId, hoveredId: hovered !== playerId ? hovered : null, currentX: ev.clientX, currentY: ev.clientY })
      }

      function onUp(ev: PointerEvent) {
        if (ev.pointerId !== dragSession.current.pointerId) return
        const ds = dragSession.current
        const wasLive = ds.live
        const sourceId = ds.playerId!
        cleanup()
        ds.pointerId = null
        ds.playerId = null
        ds.live = false
        setSetupDrag(null)
        if (!wasLive) return
        const targetId = findDropTarget(ev.clientX, ev.clientY)
        if (targetId && targetId !== sourceId) {
          const src = players.find((p) => p.id === sourceId)
          const tgt = players.find((p) => p.id === targetId)
          if (src && tgt) swapSeats(src.seatPosition, tgt.seatPosition)
        }
      }

      function onCancel() {
        cleanup()
        dragSession.current.pointerId = null
        dragSession.current.playerId = null
        dragSession.current.live = false
        setSetupDrag(null)
      }

      function cleanup() {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onCancel)
        dragSession.current.cleanupListeners = null
      }

      session.cleanupListeners = cleanup
      window.addEventListener("pointermove", onMove, { passive: true })
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onCancel)
    },
    [players, swapSeats, findDropTarget]
  )

  // ── Elimination toasts ────────────────────────────────────────────────────

  const prevEliminatedIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (phase !== "active") return
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
  }, [players, currentTurn, phase])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function playerName(p: typeof players[0]) {
    return p.displayName || (p.isMe ? myDisplayName : null) || p.commanderName || `Seat ${p.seatPosition}`
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  function handleStartGame(startingIndex: number) {
    startGame(startingIndex)
    setPhase("active")
    setShowStartModal(false)
  }

  function rollAllDice() {
    const newRolls: Record<string, number> = {}
    for (const p of players) newRolls[p.id] = Math.floor(Math.random() * 20) + 1
    setRolls(newRolls)
  }

  function applyPlayerUpdates(playerId: string, updates: { commanderName: string; commanderImageUri?: string; displayName?: string; isMe: boolean; seatPosition: SeatPosition }) {
    if (updates.isMe) {
      for (const p of players) {
        if (p.id !== playerId && p.isMe) updatePlayer(p.id, { isMe: false })
      }
    }
    const current = players.find((p) => p.id === playerId)
    if (current && updates.seatPosition !== current.seatPosition) {
      const displaced = players.find((p) => p.id !== playerId && p.seatPosition === updates.seatPosition)
      if (displaced) updatePlayer(displaced.id, { seatPosition: current.seatPosition })
    }
    updatePlayer(playerId, updates)
  }

  function handleSaveCommander(playerId: string, updates: { commanderName: string; commanderImageUri?: string; displayName?: string; isMe: boolean; seatPosition: SeatPosition }) {
    applyPlayerUpdates(playerId, updates)
    setEditingPlayerId(null)
  }

  function handleSaveAndNavigate(playerId: string, updates: { commanderName: string; commanderImageUri?: string; displayName?: string; isMe: boolean; seatPosition: SeatPosition }, direction: "prev" | "next") {
    applyPlayerUpdates(playerId, updates)
    const idx = players.findIndex((p) => p.id === playerId)
    const nextIdx = direction === "prev" ? idx - 1 : idx + 1
    const nextPlayer = players[nextIdx]
    setEditingPlayerId(nextPlayer?.id ?? null)
  }

  // ── Exit / save ───────────────────────────────────────────────────────────

  function handleSaveExit() {
    onExit(buildExitResult())
  }

  function buildExitResult(winnerIdOverride?: string) {
    const knockoutTurns: Record<string, number> = {}
    const mappedPlayers: Partial<Player>[] = players.map((p) => {
      if (p.eliminatedOnTurn !== undefined) knockoutTurns[p.id] = p.eliminatedOnTurn
      return {
        id: p.id,
        seatPosition: p.seatPosition,
        displayName: p.displayName,
        commanderName: p.commanderName,
        commanderImageUri: p.commanderImageUri,
        partnerName: p.partnerName,
        partnerImageUri: p.partnerImageUri,
        isMe: p.isMe,
        knockoutTurn: p.eliminatedOnTurn,
      }
    })
    return { winTurn: currentTurn, knockoutTurns, winnerId: winnerIdOverride ?? winnerId ?? undefined, players: mappedPlayers }
  }

  function buildRematchPlayers(): Partial<Player>[] {
    return players.map((p) => ({
      id: p.id,
      seatPosition: p.seatPosition,
      displayName: p.displayName,
      commanderName: p.commanderName,
      commanderImageUri: p.commanderImageUri,
      isMe: p.isMe,
    }))
  }

  function handleDiscard() {
    onExit()
  }

  function handleSaveAndRematchAction() {
    onSaveAndRematch(buildExitResult(), buildRematchPlayers())
  }

  function handleRematch() {
    onRematch(buildRematchPlayers())
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const playerCount = Math.min(players.length, 6) as 2 | 3 | 4 | 5 | 6
  const layouts = LAYOUTS[playerCount] ?? LAYOUTS[4]
  const winner = winnerId ? players.find((p) => p.id === winnerId) : null

  const editingPlayer = editingPlayerId ? players.find((p) => p.id === editingPlayerId) : null

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950 overflow-hidden touch-none select-none">
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />

      {/* Board */}
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
              data-drop-target={player.id}
              style={{ gridColumn: layout.gridColumn, gridRow: layout.gridRow }}
              className="min-w-0 min-h-0"
            >
              <PlayerTile
                player={player}
                playerIndex={idx}
                rotation={layout.rotation}
                isActive={phase === "active" && idx === activeSeatIndex && !winnerId}
                isDragActive={phase === "setup" ? !!setupDrag : (phase === "active" && !!drag)}
                isDragSource={phase === "setup" ? setupDrag?.sourceId === player.id : drag?.sourcePlayerId === player.id}
                isDropTarget={phase === "setup" ? setupDrag?.hoveredId === player.id : drag?.hoveredTargetId === player.id}
                allPlayers={players}
                onAdjustDelta={(delta) => adjustDelta(player.id, delta)}
                onAvatarPointerDown={(e) => handleAvatarPointerDown(e, player.id)}
                onAdjustPoison={(delta) => adjustPoison(player.id, delta)}
                isSetup={phase === "setup"}
                onAvatarTap={phase === "setup" ? () => setEditingPlayerId(player.id) : undefined}
                onTilePointerDown={phase === "setup" ? (e) => handleSetupTilePointerDown(e, player.id) : undefined}
              />
            </div>
          )
        })}
      </div>

      {/* Setup overlay — center hub replaced by Start Game */}
      {phase === "setup" && (
        <div className="absolute inset-0 flex items-center justify-center z-[62] pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-3">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold text-center">
              Tap to set commanders · Drag to swap seats
            </p>
            <button
              onClick={() => { setRolls({}); setShowStartModal(true) }}
              className="px-8 py-3 rounded-2xl bg-white text-gray-900 font-bold text-base shadow-2xl hover:bg-gray-100 active:scale-95 transition-all"
            >
              Start Game
            </button>
            <button
              onClick={handleDiscard}
              className="text-gray-500 text-xs hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Who goes first modal */}
      {showStartModal && (() => {
        const allRolled = players.length > 0 && players.every((p) => rolls[p.id] !== undefined)
        const maxRoll = allRolled ? Math.max(...players.map((p) => rolls[p.id])) : 0
        const tiedPlayers = allRolled ? players.filter((p) => rolls[p.id] === maxRoll) : []
        const hasTie = tiedPlayers.length > 1
        const highRollPlayer = !hasTie ? tiedPlayers[0] : undefined
        const highRollIdx = highRollPlayer ? players.findIndex((p) => p.id === highRollPlayer.id) : -1
        return (
          <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4 w-80 shadow-2xl max-h-[85vh] overflow-y-auto">
              <p className="text-white font-bold text-center text-lg">Who goes first?</p>

              {/* Roll section */}
              <div className="flex flex-col gap-3">
                <p className="text-gray-400 text-[10px] uppercase tracking-widest text-center font-semibold">High roll starts</p>
                {players.map((p, idx) => {
                  const color = playerColor(idx)
                  const roll = rolls[p.id]
                  const isWinner = allRolled && !hasTie && p.id === highRollPlayer?.id
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", color.dot)} />
                      <span className="text-sm text-white truncate flex-1">{playerName(p)}</span>
                      <span className={cn("text-sm font-black tabular-nums w-7 text-right", isWinner ? "text-yellow-300" : roll !== undefined ? "text-white" : "text-gray-600")}>
                        {roll ?? "—"}
                      </span>
                    </div>
                  )
                })}
                <button
                  onClick={rollAllDice}
                  className="w-full py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm active:scale-95 transition-all"
                >
                  🎲 Roll
                </button>
                {allRolled && hasTie && (
                  <p className="text-yellow-400 text-xs text-center font-semibold">Tie! Roll again.</p>
                )}
                {allRolled && !hasTie && highRollIdx >= 0 && (
                  <button
                    onClick={() => handleStartGame(highRollIdx)}
                    className="w-full py-2.5 rounded-xl bg-yellow-500 text-gray-900 font-bold text-sm hover:bg-yellow-400 active:scale-95 transition-all"
                  >
                    ⚡ Start with {playerName(highRollPlayer!)}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-gray-500 text-xs">or choose</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              {/* Manual pick */}
              <div className="flex flex-col gap-2">
                {players.map((p, idx) => {
                  const color = playerColor(idx)
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleStartGame(idx)}
                      className={cn("w-full py-2 px-3 rounded-xl border font-semibold text-sm text-left flex items-center gap-2 hover:bg-gray-800 active:scale-95 transition-all text-white", color.border)}
                    >
                      <span className={cn("w-2 h-2 rounded-full shrink-0", color.dot)} />
                      {playerName(p)}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setShowStartModal(false)}
                className="text-gray-500 text-xs text-center hover:text-gray-300 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )
      })()}

      {/* Turn Hub — only in active phase */}
      {phase === "active" && (
        <div className="absolute inset-0 flex items-center justify-center z-[62] pointer-events-none">
          <div className="pointer-events-auto">
            <TurnHub
              currentTurn={currentTurn}
              turnStartedAt={turnStartedAt}
              activeSeatIndex={activeSeatIndex}
              players={players}
              isDragging={!!drag}
              onEndTurn={endTurn}
              onEndGame={() => { setPickingWinnerForRematch(false); setShowEndGameConfirm(true) }}
            />
          </div>
        </div>
      )}

      {/* Drag ghost */}
      {phase === "active" && drag && (() => {
        const dragIdx    = players.findIndex((p) => p.id === drag.sourcePlayerId)
        const dragPlayer = players[dragIdx]
        const color      = playerColor(dragIdx)
        const target     = drag.hoveredTargetId ? players.find((p) => p.id === drag.hoveredTargetId) : null
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
                {dragPlayer && playerName(dragPlayer)} attacking → {target && playerName(target)}
              </div>
            )}
          </div>
        )
      })()}

      {/* Setup drag ghost */}
      {phase === "setup" && setupDrag && (() => {
        const srcIdx    = players.findIndex((p) => p.id === setupDrag.sourceId)
        const srcPlayer = players[srcIdx]
        const color     = playerColor(srcIdx)
        const target    = setupDrag.hoveredId ? players.find((p) => p.id === setupDrag.hoveredId) : null
        const name      = srcPlayer ? playerName(srcPlayer) : `Seat ?`
        return (
          <div
            className="fixed pointer-events-none z-[64] flex flex-col items-center gap-1.5"
            style={{ left: setupDrag.currentX, top: setupDrag.currentY, transform: "translate(-50%, -50%)" }}
          >
            <div
              className={cn("rounded-full overflow-hidden border-2 shadow-2xl", color.border)}
              style={{ width: 64, height: 64 }}
            >
              {srcPlayer?.commanderImageUri ? (
                <img src={srcPlayer.commanderImageUri} alt="" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className={cn("w-full h-full flex items-center justify-center", color.bg)}>
                  <span className="text-xl font-bold text-white/60">
                    {(srcPlayer?.commanderName || `${srcPlayer?.seatPosition}`).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {target && (
              <div className="bg-blue-900/90 text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-500/30 whitespace-nowrap">
                Moving {name} to Seat {target.seatPosition}
              </div>
            )}
          </div>
        )
      })()}

      {/* End Game confirmation */}
      {showEndGameConfirm && !winnerId && (
        <div className="absolute inset-0 z-[66] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl p-5 flex flex-col gap-3 w-72 shadow-2xl">
            {pickingWinnerForRematch ? (
              <>
                <p className="text-foreground font-bold text-center text-base">Who won?</p>
                <div className="flex flex-col gap-2">
                  {players.filter((p) => !p.isEliminated).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setShowEndGameConfirm(false)
                        setPickingWinnerForRematch(false)
                        onSaveAndRematch(buildExitResult(p.id), buildRematchPlayers())
                      }}
                      className="w-full h-10 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 active:scale-95 transition-all truncate px-3"
                    >
                      {p.displayName || p.commanderName || `Seat ${p.seatPosition}`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPickingWinnerForRematch(false)}
                  className="text-muted-foreground text-xs text-center hover:text-foreground transition-colors"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <p className="text-foreground font-bold text-center text-base">End Game?</p>
                <button
                  onClick={() => { setShowEndGameConfirm(false); handleSaveExit() }}
                  className="w-full h-10 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  Save Game
                </button>
                <button
                  onClick={() => setPickingWinnerForRematch(true)}
                  className="w-full h-10 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  Save &amp; Rematch
                </button>
                <button
                  onClick={() => { setShowEndGameConfirm(false); handleRematch() }}
                  className="w-full h-10 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted active:scale-95 transition-all"
                >
                  Rematch
                </button>
                <button
                  onClick={() => { setShowEndGameConfirm(false); handleDiscard() }}
                  className="w-full h-10 rounded-xl border border-destructive/40 text-destructive font-semibold text-sm hover:bg-destructive/10 active:scale-95 transition-all"
                >
                  Discard Game
                </button>
                <button
                  onClick={() => setShowEndGameConfirm(false)}
                  className="text-muted-foreground text-xs text-center hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
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

      {/* Commander edit modal (setup only) */}
      {editingPlayer && (() => {
        const editingPlayerIdx = players.findIndex((p) => p.id === editingPlayer.id)
        return (
          <CommanderEditModal
            key={editingPlayer.id}
            seatLabel={`Player ${editingPlayerIdx + 1}`}
            commanderName={editingPlayer.commanderName}
            commanderImageUri={editingPlayer.commanderImageUri}
            displayName={editingPlayer.displayName}
            seatPosition={editingPlayer.seatPosition}
            totalSeats={players.length}
            knownPlayerNames={knownPlayerNames}
            recentMyCommanders={recentMyCommanders}
            myDisplayName={myDisplayName}
            hasPrev={editingPlayerIdx > 0}
            hasNext={editingPlayerIdx < players.length - 1}
            onSave={(updates) => handleSaveCommander(editingPlayer.id, updates)}
            onSaveAndPrev={(updates) => handleSaveAndNavigate(editingPlayer.id, updates, "prev")}
            onSaveAndNext={(updates) => handleSaveAndNavigate(editingPlayer.id, updates, "next")}
            onCancel={() => setEditingPlayerId(null)}
          />
        )
      })()}

      {/* Winner overlay */}
      {winner && (
        <div className="animate-in fade-in duration-500">
          <WinnerOverlay
            winner={winner}
            players={players}
            startedAt={state.startedAt}
            currentTurn={currentTurn}
            onSave={handleSaveExit}
            onSaveAndRematch={handleSaveAndRematchAction}
            onRematch={handleRematch}
          />
        </div>
      )}
    </div>
  )
}
