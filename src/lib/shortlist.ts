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

export interface WinconShortlistItem {
  name: string
  games: number
  lastPlayedISO?: string
}

const DAY = 24 * 60 * 60 * 1000

export function formatRelative(iso?: string): string | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 14) return "last week"
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** Fuzzy match: forgives partial words and out-of-order tokens. Lower = better;
 *  null when any token is missing. */
export function matchScore(name: string, query: string): number | null {
  const n = name.toLowerCase()
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null
  let score = 0
  for (const token of tokens) {
    const idx = n.indexOf(token)
    if (idx < 0) return null
    score += idx
  }
  return score
}

/** Aggregate every key wincon card logged across game history, most used
 *  first (recency, then name, breaks ties). */
export function buildWinconShortlist(games: Game[]): WinconShortlistItem[] {
  const map = new Map<string, { games: number; last: string }>()
  for (const game of games) {
    for (const card of game.keyWinconCards ?? []) {
      const acc = map.get(card) ?? { games: 0, last: game.playedAt }
      acc.games += 1
      if (new Date(game.playedAt).getTime() > new Date(acc.last).getTime()) {
        acc.last = game.playedAt
      }
      map.set(card, acc)
    }
  }
  return Array.from(map.entries())
    .map(([name, a]) => ({ name, games: a.games, lastPlayedISO: a.last }))
    .sort(
      (a, b) =>
        b.games - a.games ||
        new Date(b.lastPlayedISO ?? 0).getTime() - new Date(a.lastPlayedISO ?? 0).getTime() ||
        a.name.localeCompare(b.name)
    )
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
      const won = game.winnerId === p.id
      occ.push({ playedAt: game.playedAt, won, player: p })
      // Partners are commanders this player has played too — surface them in
      // the same recents list so both pickers can offer them one-tap.
      if (p.partnerName?.trim()) {
        occ.push({
          playedAt: game.playedAt,
          won,
          player: {
            commanderName: p.partnerName,
            commanderImageUri: p.partnerImageUri,
            commanderManaCost: p.partnerManaCost,
            commanderTypeLine: p.partnerTypeLine,
          },
        })
      }
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
