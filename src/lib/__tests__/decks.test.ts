import { describe, it, expect } from "vitest"
import { findDeckForCommander } from "@/lib/decks"
import { isFastMana } from "@/lib/fastMana"
import type { Deck } from "@/types"

function makeDeck(over: Partial<Deck>): Deck {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    name: over.name ?? "Deck",
    commanderName: over.commanderName ?? "Commander",
    partnerName: over.partnerName,
    colorIdentity: over.colorIdentity,
    source: over.source ?? "text",
    sourceUrl: over.sourceUrl,
    cards: over.cards ?? [],
    fastManaCards: over.fastManaCards ?? [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  }
}

describe("findDeckForCommander", () => {
  const decks = [
    makeDeck({ id: "a", commanderName: "Krenko, Mob Boss" }),
    makeDeck({ id: "b", commanderName: "Thrasios, Triton Hero", partnerName: "Tymna the Weaver" }),
  ]

  it("matches on commander name case-insensitively", () => {
    expect(findDeckForCommander(decks, "krenko, mob boss")?.id).toBe("a")
  })

  it("returns undefined with no commander or no match", () => {
    expect(findDeckForCommander(decks, undefined)).toBeUndefined()
    expect(findDeckForCommander(decks, "Atraxa, Praetors' Voice")).toBeUndefined()
  })

  it("matches partner pairs and prefers the partner match", () => {
    expect(findDeckForCommander(decks, "Thrasios, Triton Hero", "Tymna the Weaver")?.id).toBe("b")
    // Matching on the partner name alone still resolves the deck
    expect(findDeckForCommander(decks, "Tymna the Weaver")?.id).toBe("b")
  })
})

describe("isFastMana", () => {
  it("recognizes staples case-insensitively", () => {
    expect(isFastMana("Sol Ring")).toBe(true)
    expect(isFastMana("mana crypt")).toBe(true)
    expect(isFastMana("Dark Ritual")).toBe(true)
    expect(isFastMana("Dimir Signet")).toBe(true)
  })

  it("rejects non-fast-mana cards", () => {
    expect(isFastMana("Rhystic Study")).toBe(false)
    expect(isFastMana("Cyclonic Rift")).toBe(false)
  })
})
