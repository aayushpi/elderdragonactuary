import type { Player, SeatPosition } from "@/types"

export function swapSeats(
  players: Partial<Player>[],
  slotA: SeatPosition,
  slotB: SeatPosition
): Partial<Player>[] {
  return players.map((p) => {
    if (p.seatPosition === slotA) return { ...p, seatPosition: slotB }
    if (p.seatPosition === slotB) return { ...p, seatPosition: slotA }
    return p
  })
}

export function autoAssignSeats(players: Partial<Player>[]): Partial<Player>[] {
  const used = new Set(
    players.map((p) => p.seatPosition).filter((s): s is SeatPosition => s !== undefined)
  )
  let next = 1
  return players.map((p) => {
    if (p.seatPosition !== undefined) return p
    while (used.has(next as SeatPosition)) next++
    const seat = next as SeatPosition
    used.add(seat)
    next++
    return { ...p, seatPosition: seat }
  })
}

export function getMirroredSeatOrder(totalPlayers: number): number[] {
  if (totalPlayers < 1) return []
  if (totalPlayers === 5) return [1, 2, 3, 5, 4]
  if (totalPlayers === 6) return [1, 2, 3, 6, 5, 4]

  const rightEnd = Math.floor(totalPlayers / 2) + 1
  const leftSeats = [1]
  const rightSeats: number[] = []
  for (let seat = totalPlayers; seat >= rightEnd + 1; seat--) leftSeats.push(seat)
  for (let seat = 2; seat <= rightEnd; seat++) rightSeats.push(seat)

  const mirrored: number[] = []
  const rows = Math.max(leftSeats.length, rightSeats.length)
  for (let i = 0; i < rows; i++) {
    if (leftSeats[i] !== undefined) mirrored.push(leftSeats[i])
    if (rightSeats[i] !== undefined) mirrored.push(rightSeats[i])
  }
  return mirrored
}
