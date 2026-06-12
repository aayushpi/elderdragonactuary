import type { Game, MtgColor, Player } from "@/types"

export interface CommanderShortlistItem {
  name: string
  games: number
  winRate: number // 0..1
  lastPlayedISO?: string
  colorIdentity?: MtgColor[]
  manaCost?: string
  imageUri?: string
  typeLine?: string
}

export interface ShortlistOccurrence {
  playedAt: string
  won: boolean
  player: Partial<Player>
}

/** Collapse a player's game appearances into a recents shortlist (games, win
 *  rate, recency, color identity), ordered most-recently-played first. */
export function buildShortlist(occurrences: ShortlistOccurrence[]): CommanderShortlistItem[] {
  interface Acc {
    games: number
    wins: number
    last: string
    colorIdentity?: MtgColor[]
    manaCost?: string
    imageUri?: string
    typeLine?: string
  }
  const map = new Map<string, Acc>()
  for (const { playedAt, won, player } of occurrences) {
    const name = player.commanderName
    if (!name) continue
    const acc = map.get(name) ?? { games: 0, wins: 0, last: playedAt }
    acc.games += 1
    if (won) acc.wins += 1
    const isLatest = new Date(playedAt).getTime() >= new Date(acc.last).getTime()
    if (isLatest || !acc.colorIdentity) {
      if (isLatest) acc.last = playedAt
      acc.colorIdentity = player.commanderColorIdentity ?? acc.colorIdentity
      acc.manaCost = player.commanderManaCost ?? acc.manaCost
      acc.imageUri = player.commanderImageUri ?? acc.imageUri
      acc.typeLine = player.commanderTypeLine ?? acc.typeLine
    }
    map.set(name, acc)
  }
  return Array.from(map.entries())
    .map(([name, a]) => ({
      name,
      games: a.games,
      winRate: a.games ? a.wins / a.games : 0,
      lastPlayedISO: a.last,
      colorIdentity: a.colorIdentity,
      manaCost: a.manaCost,
      imageUri: a.imageUri,
      typeLine: a.typeLine,
    }))
    .sort((a, b) => new Date(b.lastPlayedISO).getTime() - new Date(a.lastPlayedISO).getTime())
}

/** Build the "you" shortlist plus a per-opponent map (keyed by lowercased
 *  display name) from full game history. */
export function buildPlayerShortlists(games: Game[]): {
  myShortlist: CommanderShortlistItem[]
  opponentShortlists: Map<string, CommanderShortlistItem[]>
} {
  const occByKey = new Map<string, ShortlistOccurrence[]>()
  for (const game of games) {
    for (const p of game.players) {
      if (!p.commanderName) continue
      const key = p.isMe ? "__me__" : p.displayName?.trim().toLowerCase()
      if (!key) continue
      const occ = occByKey.get(key) ?? []
      occ.push({ playedAt: game.playedAt, won: game.winnerId === p.id, player: p })
      occByKey.set(key, occ)
    }
  }
  const opponentShortlists = new Map<string, CommanderShortlistItem[]>()
  for (const [key, occ] of occByKey) {
    if (key === "__me__") continue
    opponentShortlists.set(key, buildShortlist(occ))
  }
  return { myShortlist: buildShortlist(occByKey.get("__me__") ?? []), opponentShortlists }
}
