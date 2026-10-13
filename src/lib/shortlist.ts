import type { Game, MtgColor, Player } from "@/types"
import { deckColorIdentity, deckKey, orderedDeck, type DeckHalf } from "@/lib/commanderIdentity"

export interface CommanderShortlistItem {
  /** Deck label: the commander, or "A + B" for a pairing. */
  name: string
  /** The first (or only) commander's card name. */
  commanderName?: string
  /** Second commander (partner, background…) when the deck is a pairing. */
  partner?: DeckHalf
  /** The first commander's own colors; `colorIdentity` is the whole deck's. */
  commanderColorIdentity?: MtgColor[]
  games: number
  winRate: number // 0..1
  lastPlayedISO?: string
  colorIdentity?: MtgColor[]
  manaCost?: string
  imageUri?: string
  typeLine?: string
}

export interface DeckAssignment {
  commanderName: string
  commanderImageUri?: string
  commanderColorIdentity?: MtgColor[]
  commanderManaCost?: string
  commanderTypeLine?: string
  partnerName?: string
  partnerImageUri?: string
  partnerColorIdentity?: MtgColor[]
  partnerManaCost?: string
  partnerTypeLine?: string
}

/** The fields to set on a player when a shortlist deck is picked. Always sets
 *  the partner keys, so picking a solo deck clears a stale partner. The
 *  item's colorIdentity is the whole deck's, so the halves' own identities are
 *  used when known. */
export function shortlistItemToDeck(item: CommanderShortlistItem): DeckAssignment {
  return {
    commanderName: item.commanderName ?? item.name,
    commanderImageUri: item.imageUri,
    commanderColorIdentity: item.partner ? item.commanderColorIdentity ?? item.colorIdentity : item.colorIdentity,
    commanderManaCost: item.manaCost,
    commanderTypeLine: item.typeLine,
    partnerName: item.partner?.name,
    partnerImageUri: item.partner?.imageUri,
    partnerColorIdentity: item.partner?.colorIdentity,
    partnerManaCost: item.partner?.manaCost,
    partnerTypeLine: item.partner?.typeLine,
  }
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
 *  rate, recency, color identity), ordered most-recently-played first. A
 *  partner pairing is one deck, not two commanders. */
export function buildShortlist(occurrences: ShortlistOccurrence[]): CommanderShortlistItem[] {
  interface Acc {
    games: number
    wins: number
    last: string
    commanderName?: string
    partner?: DeckHalf
    commanderColorIdentity?: MtgColor[]
    colorIdentity?: MtgColor[]
    manaCost?: string
    imageUri?: string
    typeLine?: string
  }
  const map = new Map<string, Acc>()
  for (const { playedAt, won, player } of occurrences) {
    const name = deckKey(player)
    if (!name) continue
    const acc = map.get(name) ?? { games: 0, wins: 0, last: playedAt }
    acc.games += 1
    if (won) acc.wins += 1
    const isLatest = new Date(playedAt).getTime() >= new Date(acc.last).getTime()
    if (isLatest || !acc.colorIdentity) {
      if (isLatest) acc.last = playedAt
      const [primary, secondary] = orderedDeck(player)
      const colors = deckColorIdentity(player)
      acc.commanderName = primary.name
      acc.commanderColorIdentity = primary.colorIdentity ?? acc.commanderColorIdentity
      acc.colorIdentity = colors.length > 0 || player.commanderColorIdentity ? colors : acc.colorIdentity
      acc.manaCost = primary.manaCost ?? acc.manaCost
      acc.imageUri = primary.imageUri ?? acc.imageUri
      acc.typeLine = primary.typeLine ?? acc.typeLine
      acc.partner = secondary
        ? { ...secondary, imageUri: secondary.imageUri ?? acc.partner?.imageUri }
        : undefined
    }
    map.set(name, acc)
  }
  return Array.from(map.entries())
    .map(([name, a]) => ({
      name,
      commanderName: a.commanderName,
      partner: a.partner,
      commanderColorIdentity: a.commanderColorIdentity,
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

/** Single cards this player has used as either half of a pairing — the
 *  one-tap list for the second-commander picker. Excludes `exclude` (the
 *  commander already in the first slot). */
export function buildPartnerShortlist(
  items: CommanderShortlistItem[],
  exclude?: string,
): CommanderShortlistItem[] {
  const skip = exclude?.trim().toLowerCase()
  const map = new Map<string, CommanderShortlistItem>()
  for (const item of items) {
    if (!item.partner) continue
    const halves: DeckHalf[] = [
      {
        name: item.commanderName ?? item.name,
        imageUri: item.imageUri,
        manaCost: item.manaCost,
        typeLine: item.typeLine,
        colorIdentity: item.commanderColorIdentity,
      },
      item.partner,
    ]
    for (const half of halves) {
      if (!half.name || half.name.toLowerCase() === skip) continue
      const prev = map.get(half.name)
      if (prev) {
        const wins = prev.winRate * prev.games + item.winRate * item.games
        prev.games += item.games
        prev.winRate = wins / prev.games
        if ((item.lastPlayedISO ?? "") > (prev.lastPlayedISO ?? "")) prev.lastPlayedISO = item.lastPlayedISO
        prev.imageUri ??= half.imageUri
        prev.colorIdentity ??= half.colorIdentity
        continue
      }
      map.set(half.name, {
        name: half.name,
        commanderName: half.name,
        games: item.games,
        winRate: item.winRate,
        lastPlayedISO: item.lastPlayedISO,
        colorIdentity: half.colorIdentity,
        manaCost: half.manaCost,
        imageUri: half.imageUri,
        typeLine: half.typeLine,
      })
    }
  }
  return [...map.values()].sort(
    (a, b) => (b.lastPlayedISO ?? "").localeCompare(a.lastPlayedISO ?? "")
  )
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
