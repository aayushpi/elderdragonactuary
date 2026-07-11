import type { DeckSource } from "@/types"

export interface ParsedCardLine {
  name: string
  qty: number
}

export interface ParsedDeck {
  commanders: string[]
  cards: ParsedCardLine[] // main deck, excluding the commander(s)
  source: DeckSource
  sourceUrl?: string
  name?: string
}

// ─── Plain-text decklist parsing ──────────────────────────────────────────────

const COMMANDER_HEADER = /^(commanders?|command zone)\b/i
const IGNORE_HEADER = /^(sideboard|side board|maybe ?board|considering|tokens?|companion|planechase|scheme|emblem)\b/i
// A whole line that is just a section/category label (optionally "(12)" or ":")
const SECTION_HEADER =
  /^(deck|mainboard|main deck|main|creatures?|instants?|sorcer(y|ies)|artifacts?|enchantments?|planeswalkers?|lands?|basics?|nonbasics?|battles?|other|ramp|removal|card draw|draw|utility|lands)\b\s*\(?\d*\)?:?\s*$/i

const COMMANDER_MARKER = /\*\s*(cmdr|commander)\s*\*/i

/** Strip set/collector suffixes, foil/category markers, and stray annotations
 *  from a card name so it round-trips through Scryfall. */
function cleanCardName(raw: string): string {
  let name = raw.trim()
  // Trailing "*F*", "*E*", "*CMDR*" style markers
  name = name.replace(/\*[^*]*\*/g, " ")
  // Bracketed category tags: "[Ramp]", "[Commander]"
  name = name.replace(/\[[^\]]*\]/g, " ")
  // Trailing set code + collector number: "(C21) 263" or "(NEO)"
  name = name.replace(/\([A-Za-z0-9]{2,6}\)\s*\d*\s*$/g, " ")
  // Deckstats/other trailing "#anything"
  name = name.replace(/#.*$/g, " ")
  // Collapse whitespace
  return name.replace(/\s+/g, " ").trim()
}

type Section = "deck" | "commander" | "ignore"

/**
 * Parse a pasted decklist. Handles quantity prefixes ("1", "1x", "4"), set/
 * collector suffixes, "//"/"#" comments, section headers (Commander, Deck,
 * Sideboard…) and inline `*CMDR*` markers. Cards with no detectable commander
 * still parse — the caller confirms the commander separately.
 */
export function parseDecklistText(text: string): ParsedDeck {
  const commanders: string[] = []
  const cardMap = new Map<string, number>() // lowercased name → qty (dedup, preserve first casing)
  const casing = new Map<string, string>()
  let section: Section = "deck"

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line) continue
    // Comments
    if (line.startsWith("//") || line.startsWith("#")) continue
    // Deckstats sideboard prefix
    if (/^sb:\s*/i.test(line)) continue

    // Section headers
    if (COMMANDER_HEADER.test(line) && !/^\d/.test(line)) {
      section = "commander"
      continue
    }
    if (IGNORE_HEADER.test(line) && !/^\d/.test(line)) {
      section = "ignore"
      continue
    }
    if (SECTION_HEADER.test(line)) {
      section = "deck"
      continue
    }

    const isCommanderMarked = COMMANDER_MARKER.test(line)

    // Quantity prefix: "1 ", "1x ", "10 "
    let qty = 1
    const qtyMatch = line.match(/^(\d+)\s*[xX]?\s+(.*)$/)
    if (qtyMatch) {
      qty = Math.max(1, parseInt(qtyMatch[1], 10) || 1)
      line = qtyMatch[2]
    }

    const name = cleanCardName(line)
    if (!name) continue

    if (section === "ignore") continue

    if (section === "commander" || isCommanderMarked) {
      if (!commanders.some((c) => c.toLowerCase() === name.toLowerCase())) {
        commanders.push(name)
      }
      continue
    }

    const key = name.toLowerCase()
    cardMap.set(key, (cardMap.get(key) ?? 0) + qty)
    if (!casing.has(key)) casing.set(key, name)
  }

  const cards: ParsedCardLine[] = Array.from(cardMap.entries()).map(([key, q]) => ({
    name: casing.get(key)!,
    qty: q,
  }))

  return { commanders, cards, source: "text" }
}

// ─── URL detection ────────────────────────────────────────────────────────────

export function extractMoxfieldId(url: string): string | null {
  const m = url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/i)
  return m ? m[1] : null
}

export function extractArchidektId(url: string): string | null {
  const m = url.match(/archidekt\.com\/(?:decks|api\/decks)\/(\d+)/i)
  return m ? m[1] : null
}

function looksLikeUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim())
}

// ─── Remote fetching (best-effort, client-side) ───────────────────────────────

interface MoxfieldCardEntry {
  quantity?: number
  card?: { name?: string }
}
interface MoxfieldBoard {
  cards?: Record<string, MoxfieldCardEntry>
}
interface MoxfieldDeckResponse {
  name?: string
  boards?: {
    commanders?: MoxfieldBoard
    mainboard?: MoxfieldBoard
  }
  // legacy v2 shape
  commanders?: Record<string, MoxfieldCardEntry>
  mainboard?: Record<string, MoxfieldCardEntry>
}

function boardToLines(board?: MoxfieldBoard | Record<string, MoxfieldCardEntry>): ParsedCardLine[] {
  const cards = (board && "cards" in board ? board.cards : board) as
    | Record<string, MoxfieldCardEntry>
    | undefined
  if (!cards) return []
  const out: ParsedCardLine[] = []
  for (const entry of Object.values(cards)) {
    const name = entry?.card?.name
    if (name) out.push({ name, qty: entry.quantity ?? 1 })
  }
  return out
}

export async function fetchMoxfieldDeck(id: string): Promise<ParsedDeck> {
  const res = await fetch(`https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error("moxfield-fetch-failed")
  const json = (await res.json()) as MoxfieldDeckResponse

  const commanderLines = boardToLines(json.boards?.commanders ?? json.commanders)
  const mainLines = boardToLines(json.boards?.mainboard ?? json.mainboard)

  return {
    commanders: commanderLines.map((c) => c.name),
    cards: mainLines,
    source: "moxfield",
    sourceUrl: `https://www.moxfield.com/decks/${id}`,
    name: json.name,
  }
}

interface ArchidektCard {
  quantity?: number
  categories?: string[]
  card?: { oracleCard?: { name?: string }; name?: string }
}
interface ArchidektDeckResponse {
  name?: string
  cards?: ArchidektCard[]
}

export async function fetchArchidektDeck(id: string): Promise<ParsedDeck> {
  const res = await fetch(`https://archidekt.com/api/decks/${encodeURIComponent(id)}/`)
  if (!res.ok) throw new Error("archidekt-fetch-failed")
  const json = (await res.json()) as ArchidektDeckResponse

  const commanders: string[] = []
  const cards: ParsedCardLine[] = []

  for (const c of json.cards ?? []) {
    const name = c.card?.oracleCard?.name ?? c.card?.name
    if (!name) continue
    const cats = (c.categories ?? []).map((x) => x.toLowerCase())
    if (cats.includes("maybeboard") || cats.includes("sideboard")) continue
    if (cats.includes("commander")) {
      commanders.push(name)
      continue
    }
    cards.push({ name, qty: c.quantity ?? 1 })
  }

  return {
    commanders,
    cards,
    source: "archidekt",
    sourceUrl: `https://archidekt.com/decks/${id}`,
    name: json.name,
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class DeckImportError extends Error {}

/**
 * Import from either a Moxfield/Archidekt URL or a pasted decklist. Remote
 * fetches are best-effort from the browser; when a host blocks the request
 * (Moxfield often does), we throw a DeckImportError telling the user to paste
 * the list instead.
 */
export async function importDeck(input: string): Promise<ParsedDeck> {
  const trimmed = input.trim()
  if (!trimmed) throw new DeckImportError("Paste a decklist or a Moxfield/Archidekt link.")

  const isSingleLine = !/\n/.test(trimmed)

  if (isSingleLine && looksLikeUrl(trimmed)) {
    const moxId = extractMoxfieldId(trimmed)
    if (moxId) {
      try {
        return await fetchMoxfieldDeck(moxId)
      } catch {
        throw new DeckImportError(
          "Couldn't reach Moxfield from the browser. Open the deck on Moxfield, use “Export”, and paste the list here instead."
        )
      }
    }
    const archId = extractArchidektId(trimmed)
    if (archId) {
      try {
        return await fetchArchidektDeck(archId)
      } catch {
        throw new DeckImportError(
          "Couldn't reach Archidekt from the browser. Open the deck on Archidekt, use “Export”, and paste the list here instead."
        )
      }
    }
    throw new DeckImportError(
      "That link isn't a Moxfield or Archidekt deck. Paste the decklist as text instead."
    )
  }

  const parsed = parseDecklistText(trimmed)
  if (parsed.cards.length === 0 && parsed.commanders.length === 0) {
    throw new DeckImportError("No cards found. Paste one card per line, e.g. “1 Sol Ring”.")
  }
  return parsed
}
