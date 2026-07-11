import type { ScryfallCard } from "@/types"

const BASE = "https://api.scryfall.com"

async function parseCardResponse(res: Response): Promise<ScryfallCard> {
  if (!res.ok) throw new Error("Card lookup failed")
  return res.json() as Promise<ScryfallCard>
}

export interface CommanderSuggestion {
  name: string
  manaCost: string
}

export async function fetchCommanderSuggestions(q: string): Promise<CommanderSuggestion[]> {
  const res = await fetch(
    `${BASE}/cards/search?q=${encodeURIComponent("name:" + q + " is:commander legal:commander")}&order=name&unique=cards`
  )
  if (res.status === 404) return []
  if (!res.ok) throw new Error("Search failed")
  const json = await res.json() as { data: ScryfallCard[] }
  return json.data.slice(0, 20).map((card) => ({
    name: card.name,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? "",
  }))
}

export async function fetchCardSuggestions(q: string): Promise<CommanderSuggestion[]> {
  const res = await fetch(
    `${BASE}/cards/search?q=${encodeURIComponent(q)}&order=name&unique=cards`
  )
  if (res.status === 404) return []
  if (!res.ok) throw new Error("Search failed")
  const json = await res.json() as { data: ScryfallCard[] }
  return json.data.slice(0, 20).map((card) => ({
    name: card.name,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? "",
  }))
}

export async function fetchCardByName(name: string): Promise<ScryfallCard> {
  const exactRes = await fetch(`${BASE}/cards/named?exact=${encodeURIComponent(name)}`)
  if (exactRes.ok) return parseCardResponse(exactRes)

  const fuzzyRes = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`)
  if (!fuzzyRes.ok) throw new Error(`Card not found: ${name}`)
  return parseCardResponse(fuzzyRes)
}

/**
 * Look up many cards at once by exact name via Scryfall's collection endpoint.
 * Used at deck-import time to canonicalize names and pull mana cost / color
 * identity / type line cheaply. Batches into groups of 75 (Scryfall's max) and
 * silently drops names Scryfall can't resolve.
 */
export async function fetchCardCollection(names: string[]): Promise<ScryfallCard[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  const out: ScryfallCard[] = []

  for (let i = 0; i < unique.length; i += 75) {
    const batch = unique.slice(i, i + 75)
    const res = await fetch(`${BASE}/cards/collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
    })
    if (!res.ok) throw new Error("Card collection lookup failed")
    const json = (await res.json()) as { data?: ScryfallCard[] }
    if (Array.isArray(json.data)) out.push(...json.data)
  }

  return out
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
