import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LivePlayer } from "@/types/live"
import { playerColor } from "./PlayerTile"

interface TurnHubProps {
  currentTurn: number
  turnStartedAt: number
  activeSeatIndex: number
  players: LivePlayer[]
  isDragging: boolean
  onEndTurn: () => void
  onEndGame: () => void
}

export function TurnHub({ currentTurn, turnStartedAt, activeSeatIndex, players, isDragging, onEndTurn, onEndGame }: TurnHubProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
    const id = setInterval(() => setElapsed(Date.now() - turnStartedAt), 1000)
    return () => clearInterval(id)
  }, [turnStartedAt])

  const minutes = Math.floor(elapsed / 60_000)
  const seconds = Math.floor((elapsed % 60_000) / 1_000)
  const timerStr = `${minutes}:${String(seconds).padStart(2, "0")}`

  const timerColor =
    elapsed >= 480_000 ? "text-red-400" :
    elapsed >= 240_000 ? "text-amber-400" :
    "text-gray-300"

  const activePlayer = players[activeSeatIndex]
  const activeLabel = activePlayer
    ? (activePlayer.displayName || activePlayer.commanderName)
    : ""

  return (
    <div className="flex flex-col items-center gap-2 bg-gray-900/95 rounded-2xl px-4 py-3 border border-gray-700 shadow-xl min-w-[150px] max-w-[210px] w-full">
      {/* Turn order dots */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {players.map((p, i) => {
          const color = playerColor(i)
          return (
            <div
              key={p.id}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                p.isEliminated
                  ? "bg-gray-700"
                  : i === activeSeatIndex
                    ? cn(color.dot, "scale-125 shadow-sm")
                    : "bg-gray-600"
              )}
              title={p.displayName || p.commanderName}
            />
          )
        })}
      </div>

      {/* Turn info */}
      <div className="text-center leading-tight">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Turn {currentTurn}</p>
        <p className="text-sm font-semibold text-white truncate max-w-[170px]">{activeLabel}</p>
        <p className={cn("font-mono text-xl font-bold tabular-nums", timerColor)}>{timerStr}</p>
      </div>

      {/* End Turn + End Game buttons */}
      <button
        onClick={onEndTurn}
        disabled={isDragging}
        className={cn(
          "w-full h-9 flex items-center justify-center gap-1 rounded-xl font-bold text-sm transition-all duration-150",
          isDragging
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-white text-gray-900 hover:bg-gray-100 active:scale-95 shadow-md"
        )}
      >
        End Turn
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        onClick={onEndGame}
        className="w-full h-9 flex items-center justify-center rounded-xl text-xs font-semibold text-gray-400 border border-white/10 hover:text-white hover:border-white/25 active:scale-95 transition-all duration-150"
      >
        End Game
      </button>
    </div>
  )
}
