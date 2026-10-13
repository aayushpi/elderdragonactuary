import type { ScryfallCard } from "@/types"

const BASE = "https://api.scryfall.com"

async function parseCardResponse(res: Response): Promise<ScryfallCard> {
  if (!res.ok) throw new Error("Card lookup failed")
  return res.json() as Promise<ScryfallCard>
}

export interface CommanderSuggestion {
  name: string
  manaCost: string
  typeLine?: string
  card?: ScryfallCard
}

function toSuggestion(card: ScryfallCard): CommanderSuggestion {
  return {
    name: card.name,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? "",
    typeLine: card.type_line,
    card,
  }
}

async function searchCards(query: string): Promise<CommanderSuggestion[]> {
  const res = await fetch(`${BASE}/cards/search?q=${encodeURIComponent(query)}&order=name&unique=cards`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error("Search failed")
  const json = await res.json() as { data: ScryfallCard[] }
  for (const card of json.data) cardCache.set(card.name.toLowerCase(), Promise.resolve(card))
  return json.data.slice(0, 20).map(toSuggestion)
}

export function fetchCommanderSuggestions(q: string): Promise<CommanderSuggestion[]> {
  return searchCards(`name:${q} is:commander legal:commander`)
}

/** Commanders plus Backgrounds — the search for a deck's second slot. */
export function fetchPairingSuggestions(q: string): Promise<CommanderSuggestion[]> {
  return searchCards(`name:${q} (is:commander or t:background) legal:commander`)
}

export function fetchCompanionSuggestions(q: string): Promise<CommanderSuggestion[]> {
  return searchCards(`name:${q} keyword:companion`)
}

export function fetchCardSuggestions(q: string): Promise<CommanderSuggestion[]> {
  return searchCards(q)
}

/** Raw Scryfall query, e.g. the legal partners for a commander. */
export function fetchSuggestionsByQuery(query: string): Promise<CommanderSuggestion[]> {
  return searchCards(query)
}

const cardCache = new Map<string, Promise<ScryfallCard>>()

export function fetchCardByName(name: string): Promise<ScryfallCard> {
  const key = name.toLowerCase()
  const cached = cardCache.get(key)
  if (cached) return cached
  const pending = lookupCard(name)
  cardCache.set(key, pending)
  pending.catch(() => cardCache.delete(key))
  return pending
}

async function lookupCard(name: string): Promise<ScryfallCard> {
  const exactRes = await fetch(`${BASE}/cards/named?exact=${encodeURIComponent(name)}`)
  if (exactRes.ok) return parseCardResponse(exactRes)

  const fuzzyRes = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`)
  if (!fuzzyRes.ok) throw new Error(`Card not found: ${name}`)
  return parseCardResponse(fuzzyRes)
}

export function resolveArtCrop(card: ScryfallCard): string | undefined {
  // prefer art_crop (wide, minimal framing) if present, otherwise
  // fall back to the larger canonical images that were previously used.
  return (
    card.image_uris?.art_crop
    ?? card.card_faces?.[0]?.image_uris?.art_crop
    ?? card.image_uris?.large
    ?? card.card_faces?.[0]?.image_uris?.large
    ?? card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? card.image_uris?.small
    ?? card.card_faces?.[0]?.image_uris?.small
  )
}

/** High-resolution card image for use as a full-bleed background (live board).
 *  Prefers `large` (672×936) over `art_crop` (204px) to avoid blurriness on
 *  retina / high-DPI screens. */
export function resolveLargeArt(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.large
    ?? card.card_faces?.[0]?.image_uris?.large
    ?? card.image_uris?.png
    ?? card.card_faces?.[0]?.image_uris?.png
    ?? card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? card.image_uris?.art_crop
    ?? card.card_faces?.[0]?.image_uris?.art_crop
  )
}

export function resolvePng(card: ScryfallCard): string | undefined {
  // prefer PNG if available (full card image), otherwise fall back to art_crop or other sizes
  return (
    card.image_uris?.png
    ?? card.card_faces?.[0]?.image_uris?.png
    ?? card.image_uris?.large
    ?? card.card_faces?.[0]?.image_uris?.large
    ?? card.image_uris?.normal
    ?? card.card_faces?.[0]?.image_uris?.normal
    ?? card.image_uris?.art_crop
    ?? card.card_faces?.[0]?.image_uris?.art_crop
    ?? card.image_uris?.small
    ?? card.card_faces?.[0]?.image_uris?.small
  )
}
