import { useEffect, useRef, useState } from "react"
import { Minus, Plus, Skull, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LivePlayer } from "@/types/live"

const PLAYER_COLORS = [
  { border: "border-blue-500",   ring: "ring-blue-500",   bg: "bg-blue-950/60",   glow: "shadow-blue-500/40",   dot: "bg-blue-400",   badge: "bg-blue-500" },
  { border: "border-red-500",    ring: "ring-red-500",    bg: "bg-red-950/60",    glow: "shadow-red-500/40",    dot: "bg-red-400",    badge: "bg-red-500" },
  { border: "border-green-500",  ring: "ring-green-500",  bg: "bg-green-950/60",  glow: "shadow-green-500/40",  dot: "bg-green-400",  badge: "bg-green-500" },
  { border: "border-yellow-500", ring: "ring-yellow-500", bg: "bg-yellow-950/60", glow: "shadow-yellow-500/40", dot: "bg-yellow-400", badge: "bg-yellow-500" },
  { border: "border-purple-500", ring: "ring-purple-500", bg: "bg-purple-950/60", glow: "shadow-purple-500/40", dot: "bg-purple-400", badge: "bg-purple-500" },
]

export function playerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}

interface PlayerTileProps {
  player: LivePlayer
  playerIndex: number
  rotation: number
  isActive: boolean
  isDragActive: boolean
  isDragSource: boolean
  isDropTarget: boolean
  allPlayers: LivePlayer[]
  onAdjustDelta: (delta: number) => void
  onAvatarPointerDown: (e: React.PointerEvent) => void
  onAdjustPoison: (delta: number) => void
}

const LONG_PRESS_MS = 500

function LongPressButton({
  onPress,
  onLongPress,
  className,
  children,
}: {
  onPress: () => void
  onLongPress: () => void
  className?: string
  children: React.ReactNode
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  function start() {
    firedRef.current = false
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }

  function end() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!firedRef.current) onPress()
  }

  function cancel() {
    if (timerRef.current) clearTimeout(timerRef.current)
    firedRef.current = true
  }

  return (
    <button
      className={cn("select-none touch-none active:scale-90 transition-transform", className)}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      {children}
    </button>
  )
}

export function PlayerTile({
  player,
  playerIndex,
  rotation,
  isActive,
  isDragActive,
  isDragSource,
  isDropTarget,
  allPlayers,
  onAdjustDelta,
  onAvatarPointerDown,
  onAdjustPoison,
}: PlayerTileProps) {
  const color = playerColor(playerIndex)
  const [showPoison, setShowPoison] = useState(false)
  const poisonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Increment to remount the avatar div each time this player's turn begins,
  // which forces the CSS animation to restart from frame 0.
  const [avatarKey, setAvatarKey] = useState(0)
  useEffect(() => {
    if (isActive) setAvatarKey((k) => k + 1)
  }, [isActive])

  const label = player.displayName || player.commanderName

  const lifeColor =
    player.lifeTotal <= 5
      ? "text-red-400"
      : player.lifeTotal <= 10
        ? "text-orange-400"
        : player.lifeTotal > 40
          ? "text-yellow-300"
          : "text-white"

  function handleHeaderLongPress() {
    setShowPoison(true)
    if (poisonTimerRef.current) clearTimeout(poisonTimerRef.current)
    poisonTimerRef.current = setTimeout(() => setShowPoison(false), 4000)
  }

  function dismissPoison() {
    if (poisonTimerRef.current) clearTimeout(poisonTimerRef.current)
    setShowPoison(false)
  }

  const cmdDmgEntries = Object.entries(player.commanderDamageReceived).filter(([, v]) => v > 0)
  const hasArt = !!player.commanderImageUri

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Full-art commander background — rotated to face the seated player */}
      {hasArt && (
        <>
          <img
            src={player.commanderImageUri}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ transform: `rotate(${rotation}deg)` }}
            draggable={false}
          />
          {/* Symmetric gradient scrim — dark at both ends (name/buttons), lighter in center (life total) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/75 pointer-events-none" />
        </>
      )}

      {/* Main rotated content */}
      <div
        className={cn(
          "w-full h-full flex flex-col items-center justify-end gap-3 p-2 select-none transition-all duration-200",
          hasArt ? "bg-transparent" : color.bg,
          isActive && `ring-[3px] ring-inset ${color.ring}`,
          isDragSource && "opacity-40",
          player.isEliminated && "opacity-50"
        )}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Avatar — key changes each time isActive becomes true, restarting the bounce */}
        <div
          key={avatarKey}
          className={cn(
            "relative rounded-full overflow-hidden border-2 cursor-grab touch-none shrink-0",
            color.border,
            isActive && "ring-2 ring-white/50 live-avatar-bounce",
            isDragActive && !isDragSource && "ring-2 ring-white/30"
          )}
          style={{ width: "min(14vmin, 72px)", height: "min(14vmin, 72px)" }}
          onPointerDown={onAvatarPointerDown}
          data-player-id={player.id}
        >
          {player.commanderImageUri ? (
            <img
              src={player.commanderImageUri}
              alt={player.commanderName}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className={cn("w-full h-full flex items-center justify-center", color.bg)}>
              <span className="text-2xl font-bold text-white/60">
                {player.commanderName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Poison counter badge */}
          {player.poisonCounters > 0 && (
            <div className="absolute -top-1 -right-1 bg-green-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {player.poisonCounters}
            </div>
          )}

          {isActive && (
            <div className="absolute inset-0 rounded-full ring-4 ring-white/30 animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Life total + pending delta */}
        <div className="relative flex items-center justify-center">
          <span className={cn("font-black tabular-nums leading-none drop-shadow-lg", lifeColor, "text-5xl sm:text-6xl")}>
            {player.lifeTotal}
          </span>
          {player.pendingDelta !== 0 && (
            <span
              className={cn(
                "absolute -top-3 -right-6 text-sm font-bold px-1 rounded",
                player.pendingDelta > 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {player.pendingDelta > 0 ? `+${player.pendingDelta}` : player.pendingDelta}
            </span>
          )}
        </div>

        {/* Per-source commander damage */}
        {cmdDmgEntries.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <Swords className="h-3 w-3 text-orange-400 shrink-0" />
            {cmdDmgEntries.map(([sourceId, amount]) => {
              const sourceIdx = allPlayers.findIndex((p) => p.id === sourceId)
              const srcColor = playerColor(Math.max(0, sourceIdx))
              return (
                <div key={sourceId} className="flex items-center gap-0.5">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", srcColor.dot)} />
                  <span className="text-[10px] font-bold text-orange-300 tabular-nums">{amount}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Plus / minus */}
        <div className="flex items-center gap-3">
          <LongPressButton
            onPress={() => onAdjustDelta(-1)}
            onLongPress={() => onAdjustDelta(-10)}
            className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-black/70"
          >
            <Minus className="h-4 w-4" />
          </LongPressButton>
          <LongPressButton
            onPress={() => onAdjustDelta(1)}
            onLongPress={() => onAdjustDelta(10)}
            className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-black/70"
          >
            <Plus className="h-4 w-4" />
          </LongPressButton>
        </div>

        {/* Name — at bottom so it sits at the outer edge away from the center hub */}
        <LongPressButton
          onPress={() => {}}
          onLongPress={handleHeaderLongPress}
          className="w-full text-center"
        >
          <p className="text-lg font-black leading-tight truncate max-w-full text-white drop-shadow-lg">{label}</p>
          {player.commanderName && player.displayName && (
            <p className="text-xs font-semibold leading-tight truncate max-w-full text-gray-300 uppercase tracking-wider drop-shadow">{player.commanderName}</p>
          )}
        </LongPressButton>
      </div>

      {/* Elimination overlay (not rotated) */}
      {player.isEliminated && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10 pointer-events-none">
          <Skull className="h-8 w-8 text-gray-400" />
          <p className="text-gray-400 text-xs mt-1 font-medium">
            Out T{player.eliminatedOnTurn ?? "?"}
          </p>
        </div>
      )}

      {/* Drop zone highlight */}
      {isDragActive && !isDragSource && !player.isEliminated && (
        <div
          className={cn(
            "absolute inset-0 z-20 transition-all duration-150 pointer-events-none",
            isDropTarget
              ? "bg-red-500/25 border-2 border-red-400 scale-[1.03]"
              : "bg-white/5 border-2 border-white/15"
          )}
        />
      )}

      {/* Poison overlay */}
      {showPoison && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 pointer-events-auto">
          <div className="flex flex-col items-center gap-2">
            <p className="text-green-400 text-xs font-bold uppercase tracking-wide">Poison</p>
            <div className="flex items-center gap-3">
              <button
                className="w-9 h-9 rounded-full bg-gray-700 text-white text-xl flex items-center justify-center active:scale-90"
                onClick={() => { onAdjustPoison(-1); dismissPoison() }}
              >
                −
              </button>
              <span className="text-3xl font-black text-green-400 tabular-nums w-8 text-center">
                {player.poisonCounters}
              </span>
              <button
                className="w-9 h-9 rounded-full bg-gray-700 text-white text-xl flex items-center justify-center active:scale-90"
                onClick={() => { onAdjustPoison(1); dismissPoison() }}
              >
                +
              </button>
            </div>
            <button className="text-gray-500 text-xs" onClick={dismissPoison}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
