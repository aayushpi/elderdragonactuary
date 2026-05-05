import type { SeatPosition } from "./index"

export interface LivePlayer {
  id: string
  seatPosition: SeatPosition
  displayName?: string
  commanderName: string
  commanderImageUri?: string
  partnerName?: string
  partnerImageUri?: string
  isMe: boolean
  lifeTotal: number
  commanderDamageReceived: Record<string, number>
  poisonCounters: number
  isEliminated: boolean
  eliminatedOnTurn?: number
  eliminationCause?: "life" | "commanderDamage" | "poison"
  pendingDelta: number
}

export interface TurnLogEntry {
  round: number
  seatPosition: SeatPosition
  playerId: string
  durationMs: number
}

export interface DragState {
  sourcePlayerId: string
  currentX: number
  currentY: number
  hoveredTargetId: string | null
}

export interface DamageSheetState {
  sourcePlayerId: string
  targetPlayerId: string
  amount: number
  damageType: "regular" | "commander"
  lifelink: boolean
}

export interface LiveGameState {
  players: LivePlayer[]
  startedAt: number
  currentTurn: number
  activeSeatIndex: number
  turnStartedAt: number
  turnLog: TurnLogEntry[]
  drag: DragState | null
  damageSheet: DamageSheetState | null
  winnerId: string | null
}
