import type { Game, Player, SeatPosition, MtgColor } from "@/types"

let _idCounter = 0

function nextId(): string {
  return `test-id-${++_idCounter}`
}

export function resetIdCounter() {
  _idCounter = 0
}

interface MakePlayerOpts {
  id?: string
  isMe?: boolean
  commanderName?: string
  commanderColorIdentity?: MtgColor[]
  commanderManaCost?: string
  seatPosition?: SeatPosition
  hasFastMana?: boolean
  fastManaCards?: string[]
  partnerName?: string
}

export function makePlayer(opts: MakePlayerOpts = {}): Player {
  return {
    id: opts.id ?? nextId(),
    isMe: opts.isMe ?? false,
    commanderName: opts.commanderName ?? "Test Commander",
    commanderColorIdentity: opts.commanderColorIdentity,
    commanderManaCost: opts.commanderManaCost,
    seatPosition: opts.seatPosition ?? 1,
    fastMana: {
      hasFastMana: opts.hasFastMana ?? false,
      cards: opts.fastManaCards ?? [],
    },
    partnerName: opts.partnerName,
  }
}

interface MakeGameOpts {
  id?: string
  playedAt?: string
  players?: Player[]
  winnerId?: string
  winTurn?: number
  notes?: string
  winConditions?: string[]
  keyWinconCards?: string[]
  bracket?: number
}

export function makeGame(opts: MakeGameOpts = {}): Game {
  const players = opts.players ?? [
    makePlayer({ isMe: true }),
    makePlayer(),
    makePlayer(),
    makePlayer(),
  ]
  return {
    id: opts.id ?? nextId(),
    playedAt: opts.playedAt ?? "2025-06-01T00:00:00.000Z",
    players,
    winnerId: opts.winnerId ?? players[0].id,
    winTurn: opts.winTurn ?? 8,
    notes: opts.notes,
    winConditions: opts.winConditions,
    keyWinconCards: opts.keyWinconCards,
    bracket: opts.bracket,
  }
}
