import type { MtgColor, Player, ScryfallCard } from "@/types"

/** Joins the two halves of a paired deck. Not " // ", which Scryfall uses for
 *  double-faced card names. */
export const DECK_SEPARATOR = " + "

export type DeckFields = Pick<
  Partial<Player>,
  | "commanderName"
  | "commanderTypeLine"
  | "commanderColorIdentity"
  | "partnerName"
  | "partnerTypeLine"
  | "partnerColorIdentity"
>

const COLOR_ORDER: MtgColor[] = ["W", "U", "B", "R", "G"]

export function normalizeColorIdentity(colors?: MtgColor[]): MtgColor[] {
  if (!colors || colors.length === 0) return []
  return [...new Set(colors)].sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b))
}

export function isBackgroundTypeLine(typeLine?: string): boolean {
  return /\bBackground\b/.test(typeLine ?? "")
}

/** Commander halves in the order they were entered, blanks dropped. */
type DeckNameFields = { commanderName?: string; partnerName?: string }

export function deckNames(p: DeckNameFields): string[] {
  return [p.commanderName, p.partnerName]
    .map((n) => n?.trim() ?? "")
    .filter(Boolean)
}

export interface DeckHalf {
  name: string
  imageUri?: string
  manaCost?: string
  typeLine?: string
  colorIdentity?: MtgColor[]
}

export type DeckCardFields = DeckFields &
  Pick<Partial<Player>, "commanderImageUri" | "commanderManaCost" | "partnerImageUri" | "partnerManaCost">

/** The deck's halves in canonical order: a Background always sorts last,
 *  otherwise alphabetical. */
export function orderedDeck(p: DeckCardFields): DeckHalf[] {
  const halves: DeckHalf[] = [
    {
      name: p.commanderName?.trim() ?? "",
      imageUri: p.commanderImageUri,
      manaCost: p.commanderManaCost,
      typeLine: p.commanderTypeLine,
      colorIdentity: p.commanderColorIdentity,
    },
    {
      name: p.partnerName?.trim() ?? "",
      imageUri: p.partnerImageUri,
      manaCost: p.partnerManaCost,
      typeLine: p.partnerTypeLine,
      colorIdentity: p.partnerColorIdentity,
    },
  ].filter((h) => h.name)
  return halves.sort(
    (a, b) =>
      Number(isBackgroundTypeLine(a.typeLine)) - Number(isBackgroundTypeLine(b.typeLine)) ||
      a.name.localeCompare(b.name)
  )
}

/** Order-independent identity of a deck: Tymna + Thrasios and Thrasios + Tymna
 *  are the same deck. */
export function deckKey(p: DeckFields): string {
  return orderedDeck(p).map((h) => h.name).join(DECK_SEPARATOR)
}

/** Inverse of deckKey / deckLabel — the commander names in a deck string. */
export function splitDeckKey(key: string): string[] {
  return key.split(DECK_SEPARATOR).map((n) => n.trim()).filter(Boolean)
}

/** Display name for a single game's deck, in the order the user entered it. */
export function deckLabel(p: DeckNameFields, fallback = ""): string {
  const names = deckNames(p)
  return names.length > 0 ? names.join(DECK_SEPARATOR) : fallback
}

export function deckColorIdentity(p: DeckFields): MtgColor[] {
  return normalizeColorIdentity([...(p.commanderColorIdentity ?? []), ...(p.partnerColorIdentity ?? [])])
}

export function hasPartner(p: DeckFields): boolean {
  return Boolean(p.partnerName?.trim())
}

// ─── Pairing rules ──────────────────────────────────────────────────────────

export type PairingAbility =
  | { kind: "partner" }
  | { kind: "partner-with"; name: string }
  | { kind: "partner-group"; group: string }
  | { kind: "friends-forever" }
  | { kind: "choose-background" }
  | { kind: "background" }
  | { kind: "doctors-companion" }
  | { kind: "doctor" }
  | { kind: "none" }

function cardText(card: ScryfallCard): { oracle: string; typeLine: string } {
  const faces = card.card_faces ?? []
  return {
    oracle: [card.oracle_text ?? "", ...faces.map((f) => f.oracle_text ?? "")].join("\n"),
    typeLine: [card.type_line ?? "", ...faces.map((f) => f.type_line ?? "")].join(" "),
  }
}

export function pairingAbility(card: ScryfallCard): PairingAbility {
  const { oracle, typeLine } = cardText(card)
  const partnerWith = oracle.match(/^Partner with ([^(\n]+?)\s*(?:\(|$)/m)
  if (partnerWith) return { kind: "partner-with", name: partnerWith[1].trim() }
  const group = oracle.match(/^Partner\s*[—-]\s*([^(\n]+?)\s*(?:\(|$)/m)
  if (group) return { kind: "partner-group", group: group[1].trim() }
  if (/^Partner\s*(?:\(|$)/m.test(oracle)) return { kind: "partner" }
  if (/^Friends forever\b/im.test(oracle)) return { kind: "friends-forever" }
  if (/^Choose a Background\b/im.test(oracle)) return { kind: "choose-background" }
  if (/^Doctor's companion\b/im.test(oracle)) return { kind: "doctors-companion" }
  if (isBackgroundTypeLine(typeLine)) return { kind: "background" }
  if (/\bTime Lord Doctor\b/.test(typeLine)) return { kind: "doctor" }
  return { kind: "none" }
}

export function canHaveSecondCommander(ability: PairingAbility): boolean {
  return ability.kind !== "none"
}

export function isLegalPairing(
  a: { name: string; ability: PairingAbility },
  b: { name: string; ability: PairingAbility },
): boolean {
  const x = a.ability
  const y = b.ability
  if (x.kind === "partner-with" || y.kind === "partner-with") {
    return (
      (x.kind === "partner-with" && x.name.toLowerCase() === b.name.toLowerCase()) ||
      (y.kind === "partner-with" && y.name.toLowerCase() === a.name.toLowerCase())
    )
  }
  if (x.kind === "partner-group" && y.kind === "partner-group") return x.group === y.group
  if (x.kind === y.kind && (x.kind === "partner" || x.kind === "friends-forever")) return true
  const pair = new Set([x.kind, y.kind])
  if (pair.has("choose-background") && pair.has("background")) return true
  if (pair.has("doctors-companion") && pair.has("doctor")) return true
  return false
}

export type SecondSlotLabel = "Partner" | "Background" | "Doctor" | "Companion doctor" | "Second commander"

/** What to call the second commander slot, given the first commander. */
export function secondSlotLabel(ability: PairingAbility | null): SecondSlotLabel {
  switch (ability?.kind) {
    case "partner":
    case "partner-with":
    case "partner-group":
    case "friends-forever":
      return "Partner"
    case "choose-background":
      return "Background"
    case "doctors-companion":
      return "Doctor"
    case "doctor":
      return "Companion doctor"
    case "background":
      return "Second commander"
    default:
      return "Second commander"
  }
}

/** Scryfall query that lists the cards this commander can legally pair with.
 *  Null when the ability gives no useful browse list. */
export function pairingSearchQuery(ability: PairingAbility): string | null {
  switch (ability.kind) {
    case "partner":
      return 'o:"(You can have two commanders if both have partner.)" legal:commander'
    case "partner-with":
      return `!"${ability.name.replace(/"/g, "")}"`
    case "partner-group":
      return `o:"Partner—${ability.group.replace(/"/g, "")}" legal:commander`
    case "friends-forever":
      return 'o:"Friends forever" legal:commander'
    case "choose-background":
      return "t:background legal:commander"
    case "background":
      return 'o:"Choose a Background" legal:commander'
    case "doctors-companion":
      return 't:"Time Lord Doctor" legal:commander'
    case "doctor":
      return "o:\"Doctor's companion\" legal:commander"
    default:
      return null
  }
}

/** Whether the second commander can be the source of commander damage. A
 *  Background is an enchantment, so it isn't tracked as a damage source. */
export function partnerDealsCommanderDamage(p: DeckFields): boolean {
  if (!hasPartner(p)) return false
  return !isBackgroundTypeLine(p.partnerTypeLine) && !isBackgroundTypeLine(p.commanderTypeLine)
}
