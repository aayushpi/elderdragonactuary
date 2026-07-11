import type { Deck, DeckCard, MtgColor, ScryfallCard } from "@/types"
import type { ParsedDeck } from "@/lib/deckImport"
import { fetchCardCollection } from "@/lib/scryfall"
import { isFastMana } from "@/lib/fastMana"

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function cardManaCost(card: ScryfallCard): string | undefined {
  return card.mana_cost || card.card_faces?.[0]?.mana_cost || undefined
}

export interface BuildDeckInput {
  parsed: ParsedDeck
  commanderName: string
  partnerName?: string
  name?: string
}

/**
 * Turn a parsed decklist into a stored Deck: canonicalize card names against
 * Scryfall (also grabbing mana cost / color identity / type line), classify
 * fast-mana staples, and derive the commander's color identity. Names Scryfall
 * can't resolve are kept as written so nothing is silently dropped.
 */
export async function buildDeckFromParsed({
  parsed,
  commanderName,
  partnerName,
  name,
}: BuildDeckInput): Promise<Deck> {
  const commanderNames = [commanderName, partnerName].filter((n): n is string => !!n?.trim())
  const poolNames = parsed.cards.map((c) => c.name)
  const lookupNames = [...commanderNames, ...poolNames]

  let byName = new Map<string, ScryfallCard>()
  try {
    const cards = await fetchCardCollection(lookupNames)
    byName = new Map(cards.map((c) => [norm(c.name), c]))
  } catch {
    // Offline / rate-limited — fall back to names as written.
  }

  const commanderLower = new Set(commanderNames.map(norm))

  const deckCards: DeckCard[] = []
  const seen = new Set<string>()
  for (const line of parsed.cards) {
    const resolved = byName.get(norm(line.name))
    const canonicalName = resolved?.name ?? line.name
    const key = norm(canonicalName)
    if (commanderLower.has(key) || seen.has(key)) continue
    seen.add(key)
    deckCards.push({
      name: canonicalName,
      manaCost: resolved ? cardManaCost(resolved) : undefined,
      colorIdentity: (resolved?.color_identity as MtgColor[]) ?? undefined,
      typeLine: resolved?.type_line,
    })
  }

  const fastManaCards = deckCards.filter((c) => isFastMana(c.name)).map((c) => c.name)

  // Commander color identity = union of the commander cards' identities.
  const colorSet = new Set<MtgColor>()
  for (const cn of commanderNames) {
    const c = byName.get(norm(cn))
    for (const color of (c?.color_identity as MtgColor[]) ?? []) colorSet.add(color)
  }
  const colorIdentity = colorSet.size > 0 ? Array.from(colorSet) : undefined

  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: name?.trim() || parsed.name?.trim() || commanderName.trim(),
    commanderName: commanderName.trim(),
    partnerName: partnerName?.trim() || undefined,
    colorIdentity,
    source: parsed.source,
    sourceUrl: parsed.sourceUrl,
    cards: deckCards,
    fastManaCards,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Find the user's deck that matches a commander being played. Matches on
 * commander name (case-insensitive); when a partner is involved, a deck whose
 * partner also matches is preferred. This is the lightweight validation that a
 * deck's defaults only apply when it's genuinely the same deck.
 */
export function findDeckForCommander(
  decks: Deck[],
  commanderName?: string,
  partnerName?: string
): Deck | undefined {
  if (!commanderName?.trim()) return undefined
  const cmd = norm(commanderName)
  const partner = partnerName?.trim() ? norm(partnerName) : undefined

  const matches = decks.filter((d) => {
    const names = [norm(d.commanderName), d.partnerName ? norm(d.partnerName) : ""].filter(Boolean)
    return names.includes(cmd)
  })
  if (matches.length === 0) return undefined
  if (partner) {
    const withPartner = matches.find((d) =>
      [norm(d.commanderName), d.partnerName ? norm(d.partnerName) : ""].includes(partner)
    )
    if (withPartner) return withPartner
  }
  return matches[0]
}
