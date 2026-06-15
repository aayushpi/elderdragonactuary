import type { Game, MtgColor } from "@/types"
import { buildPlayerShortlists, type CommanderShortlistItem } from "@/lib/shortlist"

/* Setup data derived from game history: a combined commander shortlist for the
 * pickers, and richer pods that remember each member's usual commander so a pod
 * tap can prefill names *and* commanders. */

export interface PodMember {
  name: string
  isMe: boolean
  /** this player's most-played commander (for the pod avatar tint) */
  commander?: CommanderShortlistItem
  /** their recent decks, most-recent first — shown as one-tap chips */
  commanders: CommanderShortlistItem[]
}

export interface RichPod {
  id: string
  label: string
  size: number
  members: PodMember[]
  /** how recently this exact group last played (for ordering) */
  lastPlayedISO?: string
  games: number
}

export function buildMyDecks(games: Game[]): CommanderShortlistItem[] {
  return buildPlayerShortlists(games).myShortlist.slice(0, 4)
}

/** Per-player recent decks, keyed by lowercased display name ("you" for me).
 *  Lets the in-game commander prompt lead with that seat's own commanders. */
export function buildPlayerDecks(games: Game[]): Record<string, CommanderShortlistItem[]> {
  const { myShortlist, opponentShortlists } = buildPlayerShortlists(games)
  const out: Record<string, CommanderShortlistItem[]> = { you: myShortlist }
  for (const [k, v] of opponentShortlists) out[k] = v
  return out
}

/** Distinct opponent names from history, most-recent first — for tap-to-add. */
export function buildKnownPlayers(games: Game[]): string[] {
  const last = new Map<string, string>()
  for (const g of games) {
    for (const p of g.players) {
      const name = (p.displayName ?? "").trim()
      if (p.isMe || !name) continue
      const prev = last.get(name)
      if (!prev || g.playedAt > prev) last.set(name, g.playedAt)
    }
  }
  return [...last.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([n]) => n)
}

export function buildRecents(games: Game[]): CommanderShortlistItem[] {
  const { myShortlist, opponentShortlists } = buildPlayerShortlists(games)
  const seen = new Set<string>()
  const out: CommanderShortlistItem[] = []
  for (const item of [myShortlist, ...opponentShortlists.values()].flat()) {
    const key = item.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out.sort((a, b) => (b.lastPlayedISO ?? "").localeCompare(a.lastPlayedISO ?? "")).slice(0, 40)
}

export function buildRichPods(games: Game[]): RichPod[] {
  const { myShortlist, opponentShortlists } = buildPlayerShortlists(games)
  const myTop = myShortlist[0]

  const map = new Map<string, { members: string[]; size: number; last: string; count: number }>()
  for (const g of games) {
    const opponents = g.players
      .filter((p) => !p.isMe && (p.displayName ?? "").trim())
      .map((p) => (p.displayName as string).trim())
    if (opponents.length < 1) continue
    const key = [...opponents].sort((a, b) => a.localeCompare(b)).join("|")
    const cur = map.get(key)
    if (cur) {
      cur.count += 1
      if (g.playedAt > cur.last) cur.last = g.playedAt
    } else {
      map.set(key, { members: opponents, size: g.players.length, last: g.playedAt, count: 1 })
    }
  }

  const pods: RichPod[] = [...map.entries()].map(([key, v]) => {
    const members: PodMember[] = [
      { name: "You", isMe: true, commander: myTop, commanders: myShortlist.slice(0, 4) },
      ...v.members.map((name) => {
        const list = opponentShortlists.get(name.toLowerCase()) ?? []
        return { name, isMe: false, commander: list[0], commanders: list.slice(0, 4) }
      }),
    ]
    return {
      id: key,
      label: v.members.join(", "),
      size: v.size,
      members,
      lastPlayedISO: v.last,
      games: v.count,
    }
  })

  return pods.sort((a, b) => (b.lastPlayedISO ?? "").localeCompare(a.lastPlayedISO ?? ""))
}

export const MTG_COLORS: MtgColor[] = ["W", "U", "B", "R", "G"]
