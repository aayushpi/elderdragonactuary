/**
 * Supabase-backed storage for decks.
 *
 * Converts between the frontend `Deck` type (camelCase) and the Supabase
 * `decks` table (snake_case). Mirrors the contract in supabaseStorage.ts —
 * returns [] and no-ops gracefully when Supabase is unconfigured.
 */

import { supabase } from "@/lib/supabase"
import type { Deck } from "@/types"
import type { DeckRow } from "@/types/database"

async function getCurrentUserId(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionResp = await (supabase as any).auth.getSession()
  const s = sessionResp?.data?.session ?? null
  const userId = s?.user?.id
  if (!userId) throw new Error("No authenticated user found.")
  return userId
}

function rowToDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    commanderName: row.commander_name,
    partnerName: row.partner_name ?? undefined,
    colorIdentity: row.color_identity ?? undefined,
    source: row.source,
    sourceUrl: row.source_url ?? undefined,
    cards: row.cards ?? [],
    fastManaCards: row.fast_mana_cards ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function deckToInsert(deck: Deck, userId: string) {
  return {
    user_id: userId,
    name: deck.name,
    commander_name: deck.commanderName,
    partner_name: deck.partnerName ?? null,
    color_identity: deck.colorIdentity ?? null,
    source: deck.source,
    source_url: deck.sourceUrl ?? null,
    cards: deck.cards,
    fast_mana_cards: deck.fastManaCards,
  }
}

export async function fetchDecks(): Promise<Deck[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("decks")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data as DeckRow[]).map(rowToDeck)
}

export async function insertDeck(deck: Deck): Promise<Deck> {
  const userId = await getCurrentUserId()

  const decksTable = supabase.from("decks") as unknown as {
    insert: (values: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } }
  }

  const { data, error } = await decksTable
    .insert(deckToInsert(deck, userId))
    .select()
    .single()

  if (error) throw error
  return rowToDeck(data as DeckRow)
}

export async function updateDeck(id: string, patch: Partial<Deck>): Promise<Deck> {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.commanderName !== undefined) update.commander_name = patch.commanderName
  if (patch.partnerName !== undefined) update.partner_name = patch.partnerName ?? null
  if (patch.colorIdentity !== undefined) update.color_identity = patch.colorIdentity ?? null
  if (patch.source !== undefined) update.source = patch.source
  if (patch.sourceUrl !== undefined) update.source_url = patch.sourceUrl ?? null
  if (patch.cards !== undefined) update.cards = patch.cards
  if (patch.fastManaCards !== undefined) update.fast_mana_cards = patch.fastManaCards

  const decksTable = supabase.from("decks") as unknown as {
    update: (values: unknown) => { eq: (column: string, value: string) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } } }
  }

  const { data, error } = await decksTable
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return rowToDeck(data as DeckRow)
}

export async function removeDeck(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("decks").delete().eq("id", id)
  if (error) throw error
}
