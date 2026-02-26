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
