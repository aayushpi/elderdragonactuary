import { describe, it, expect } from "vitest"
import {
  parseDecklistText,
  extractMoxfieldId,
  extractArchidektId,
} from "@/lib/deckImport"

describe("parseDecklistText", () => {
  it("parses quantity prefixes and bare names", () => {
    const parsed = parseDecklistText("1 Sol Ring\n1x Mana Crypt\nRhystic Study\n10 Forest")
    const byName = Object.fromEntries(parsed.cards.map((c) => [c.name, c.qty]))
    expect(byName["Sol Ring"]).toBe(1)
    expect(byName["Mana Crypt"]).toBe(1)
    expect(byName["Rhystic Study"]).toBe(1)
    expect(byName["Forest"]).toBe(10)
  })

  it("separates the commander via a Commander header", () => {
    const parsed = parseDecklistText(
      "Commander\n1 Kenrith, the Returned King\n\nDeck\n1 Sol Ring\n1 Cyclonic Rift"
    )
    expect(parsed.commanders).toEqual(["Kenrith, the Returned King"])
    expect(parsed.cards.map((c) => c.name)).toEqual(["Sol Ring", "Cyclonic Rift"])
  })

  it("recognizes inline *CMDR* markers", () => {
    const parsed = parseDecklistText("1 Atraxa, Praetors' Voice *CMDR*\n1 Sol Ring")
    expect(parsed.commanders).toEqual(["Atraxa, Praetors' Voice"])
    expect(parsed.cards.map((c) => c.name)).toEqual(["Sol Ring"])
  })

  it("ignores sideboard/maybeboard and comments", () => {
    const parsed = parseDecklistText(
      "// my deck\n1 Sol Ring\n#comment\n\nMaybeboard\n1 Thoughtseize\n\nSideboard\n1 Pyroblast"
    )
    expect(parsed.cards.map((c) => c.name)).toEqual(["Sol Ring"])
  })

  it("strips set codes, collector numbers and foil markers", () => {
    const parsed = parseDecklistText("1 Sol Ring (C21) 263 *F*\n1 Cyclonic Rift (MM3) 46")
    expect(parsed.cards.map((c) => c.name)).toEqual(["Sol Ring", "Cyclonic Rift"])
  })

  it("strips Archidekt bracketed category tags", () => {
    const parsed = parseDecklistText("1x Sol Ring [Ramp]\n1x Rhystic Study [Card Draw]")
    expect(parsed.cards.map((c) => c.name)).toEqual(["Sol Ring", "Rhystic Study"])
  })

  it("sums duplicate lines and dedups", () => {
    const parsed = parseDecklistText("1 Forest\n1 Forest\n2 Forest")
    expect(parsed.cards).toEqual([{ name: "Forest", qty: 4 }])
  })

  it("skips category-type section headers without treating them as cards", () => {
    const parsed = parseDecklistText("Artifacts (2)\n1 Sol Ring\n1 Mana Crypt\nLands (1)\n1 Command Tower")
    expect(parsed.cards.map((c) => c.name)).toEqual(["Sol Ring", "Mana Crypt", "Command Tower"])
  })
})

describe("URL id extraction", () => {
  it("extracts a Moxfield public id", () => {
    expect(extractMoxfieldId("https://www.moxfield.com/decks/AbC-123_xyz")).toBe("AbC-123_xyz")
    expect(extractMoxfieldId("not a url")).toBeNull()
  })

  it("extracts an Archidekt numeric id", () => {
    expect(extractArchidektId("https://archidekt.com/decks/123456/my-deck")).toBe("123456")
    expect(extractArchidektId("https://archidekt.com/decks/789")).toBe("789")
    expect(extractArchidektId("https://www.moxfield.com/decks/abc")).toBeNull()
  })
})
