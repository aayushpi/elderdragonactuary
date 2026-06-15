import { useState } from "react"
import { Dices, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SeatPosition } from "@/types"
import type { DraftSeat } from "./setupShared"

/* Compact "who goes first" control — quick chips + a D20 roll. */
export function StarterBar({
  seats,
  value,
  onChange,
}: {
  seats: DraftSeat[]
  value: SeatPosition | null
  onChange: (s: SeatPosition) => void
}) {
  const [rolling, setRolling] = useState(false)

  function roll() {
    setRolling(true)
    let ticks = 0
    const id = window.setInterval(() => {
      onChange(seats[Math.floor(Math.random() * seats.length)].seatPosition)
      if (++ticks > 10) {
        window.clearInterval(id)
        setRolling(false)
      }
    }, 70)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {seats.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.seatPosition)}
          className={cn(
            "flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition-colors",
            value === s.seatPosition
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          )}
        >
          {value === s.seatPosition && <Crown className="h-3.5 w-3.5" />}
          {s.displayName.trim() || `Seat ${s.seatPosition}`}
        </button>
      ))}
      <button
        onClick={roll}
        className="flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-sm font-semibold text-background active:scale-95"
      >
        <Dices className={cn("h-4 w-4", rolling && "animate-spin")} /> Roll
      </button>
    </div>
  )
}
