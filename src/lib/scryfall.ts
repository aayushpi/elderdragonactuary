import type { ScryfallCard } from "@/types"

const BASE = "https://api.scryfall.com"

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

export async function fetchCardByName(name: string): Promise<ScryfallCard> {
  const res = await fetch(`${BASE}/cards/named?exact=${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Card not found: ${name}`)
  return res.json() as Promise<ScryfallCard>
}

export function resolveArtCrop(card: ScryfallCard): string | undefined {
  return card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop
}
