import type { Player } from "@/types"

export function hasInvalidKoTiming(
  players: Partial<Player>[],
  winnerId: string | null,
  winTurnInput: string
): boolean {
  if (!winnerId) return false

  const winTurn = parseInt(winTurnInput, 10)
  if (isNaN(winTurn) || winTurn < 1) return false

  const losers = players.filter((player) => player.id !== winnerId)
  if (losers.length === 0) return false

  return losers.every((player) => typeof player.knockoutTurn === "number" && player.knockoutTurn < winTurn)
}
