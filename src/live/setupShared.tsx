import type { CommanderPick } from "@/components/CommanderPicker"
import type { CommanderShortlistItem } from "@/lib/shortlist"
import type { SeatPosition } from "@/types"
import { genId, type DamageView, type LiveConfig, type LivePlayer } from "@/live/engine"
import type { PodMember, RichPod } from "./setupData"

export type DraftSeat = LivePlayer

export function blankSeat(seat: number): DraftSeat {
  return {
    id: genId(),
    seatPosition: seat as SeatPosition,
    isMe: seat === 1,
    displayName: seat === 1 ? "You" : "",
    commanderName: "",
  }
}

/** Grow/shrink a seat list to `n`, preserving existing entries. */
export function resizeSeats(prev: DraftSeat[], n: number): DraftSeat[] {
  const next: DraftSeat[] = []
  for (let i = 1; i <= n; i++) next.push(prev[i - 1] ?? blankSeat(i))
  return next.map((s, i) => ({ ...s, seatPosition: (i + 1) as SeatPosition, isMe: i === 0 }))
}

function memberToSeat(m: PodMember, i: number): DraftSeat {
  return {
    id: genId(),
    seatPosition: (i + 1) as SeatPosition,
    isMe: m.isMe,
    displayName: m.isMe ? "You" : m.name,
    commanderName: m.commander?.name ?? "",
    commanderImageUri: m.commander?.imageUri,
    commanderColorIdentity: m.commander?.colorIdentity,
    commanderManaCost: m.commander?.manaCost,
    commanderTypeLine: m.commander?.typeLine,
  }
}

export function podToSeats(pod: RichPod): DraftSeat[] {
  return pod.members.slice(0, 6).map(memberToSeat)
}

/** Pod → roster with names filled but commanders left for tonight's choice.
 *  `candidates` maps seat id → that player's recent decks (one-tap chips). */
export function podToRoster(pod: RichPod): {
  seats: DraftSeat[]
  candidates: Record<string, CommanderShortlistItem[]>
} {
  const seats = pod.members.slice(0, 6).map((m, i) => ({
    id: genId(),
    seatPosition: (i + 1) as SeatPosition,
    isMe: m.isMe,
    displayName: m.isMe ? "You" : m.name,
    commanderName: "",
  }))
  const candidates: Record<string, CommanderShortlistItem[]> = {}
  seats.forEach((s, i) => {
    candidates[s.id] = pod.members[i].commanders ?? []
  })
  return { seats, candidates }
}

export function applyShortlist(seat: DraftSeat, item: CommanderShortlistItem): DraftSeat {
  return {
    ...seat,
    commanderName: item.name,
    commanderImageUri: item.imageUri,
    commanderColorIdentity: item.colorIdentity,
    commanderManaCost: item.manaCost,
    commanderTypeLine: item.typeLine,
  }
}

export function randomStarter(seats: DraftSeat[]): SeatPosition {
  return seats[Math.floor(Math.random() * seats.length)].seatPosition
}

export function applyPick(seat: DraftSeat, pick: CommanderPick): DraftSeat {
  return {
    ...seat,
    commanderName: pick.commanderName,
    commanderImageUri: pick.commanderImageUri,
    commanderColorIdentity: pick.commanderColorIdentity,
    commanderManaCost: pick.commanderManaCost,
    commanderTypeLine: pick.commanderTypeLine,
  }
}

export function clearCommander(seat: DraftSeat): DraftSeat {
  return {
    ...seat,
    commanderName: "",
    commanderImageUri: undefined,
    commanderColorIdentity: undefined,
    commanderManaCost: undefined,
    commanderTypeLine: undefined,
  }
}

/** Build a config; commanders left blank stay blank (filled later, in-game). */
export function toConfig(
  seats: DraftSeat[],
  starter: SeatPosition,
  pod?: { id?: string; label?: string },
  opts?: { damageView?: DamageView }
): LiveConfig {
  return {
    players: seats.map((s, i) => ({
      ...s,
      seatPosition: (i + 1) as SeatPosition,
      isMe: i === 0,
      displayName: s.displayName.trim() || (i === 0 ? "You" : `Player ${i + 1}`),
    })),
    startingSeat: starter,
    podId: pod?.id,
    podLabel: pod?.label,
    damageView: opts?.damageView,
  }
}
