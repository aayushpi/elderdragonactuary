import { Button } from "@/components/ui/button"
import type { SeatPosition } from "@/types"

interface SeatPickerProps {
  value: SeatPosition | null
  onChange: (seat: SeatPosition | null) => void
  takenSeats: SeatPosition[]
  totalPlayers: number
  hasError?: boolean
}

const SEAT_LABELS: Record<number, string> = {
  1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th",
}

export function SeatPicker({ value, onChange, takenSeats, totalPlayers, hasError }: SeatPickerProps) {
  const seats = Array.from({ length: totalPlayers }, (_, i) => (i + 1) as SeatPosition)

  return (
    <div className={`flex gap-1.5 flex-wrap rounded-md transition-colors ${hasError ? "ring-1 ring-destructive p-1" : ""}`}>
      {seats.map((seat) => {
        const taken = takenSeats.includes(seat) && seat !== value
        return (
          <Button
            key={seat}
            type="button"
            size="sm"
            variant={value === seat ? "default" : "outline"}
            disabled={taken}
            className="flex-1 min-w-[3rem]"
            onClick={() => onChange(value === seat ? null : seat)}
          >
            {SEAT_LABELS[seat]}
          </Button>
        )
      })}
    </div>
  )
}
