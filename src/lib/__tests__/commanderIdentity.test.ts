import { describe, it, expect } from "vitest"
import {
  deckColorIdentity,
  deckKey,
  deckLabel,
  isLegalPairing,
  pairingAbility,
  pairingSearchQuery,
  partnerDealsCommanderDamage,
  secondSlotLabel,
  splitDeckKey,
} from "@/lib/commanderIdentity"
import type { ScryfallCard } from "@/types"

function card(name: string, oracle: string, typeLine = "Legendary Creature — Human"): ScryfallCard {
  return { id: name, name, mana_cost: "", color_identity: [], type_line: typeLine, oracle_text: oracle }
}

const tymna = card("Tymna the Weaver", "Lifelink\nPartner (You can have two commanders if both have partner.)")
const thrasios = card("Thrasios, Triton Hero", "{4}: Scry 1...\nPartner (You can have two commanders if both have partner.)")
const pir = card("Pir, Imaginative Rascal", "Partner with Toothy, Imaginary Friend (When this creature enters, target player may put Toothy into their hand from their library, then shuffle.)")
const toothy = card("Toothy, Imaginary Friend", "Partner with Pir, Imaginative Rascal (When this creature enters...)")
const wilson = card("Wilson, Refined Grizzly", "Choose a Background (You can have a Background as a second commander.)")
const background = card("Candlekeep Sage", "Commander creatures you own have ...", "Legendary Enchantment — Background")
const doctor = card("The Tenth Doctor", "Allons-y! ...", "Legendary Creature — Time Lord Doctor")
const rose = card("Rose Tyler", "Doctor's companion (You can have two commanders if the other is the Doctor.)")
const ff = card("Will the Wise", "Friends forever (You can have two commanders if both have friends forever.)")
const ff2 = card("Mike, the Dungeon Master", "Friends forever (You can have two commanders if both have friends forever.)")
const group = card("Ezio, Brash Novice", "Partner—Assassin (You can have two commanders if both have this ability.)")
const plain = card("Atraxa, Praetors' Voice", "Flying, vigilance, deathtouch, lifelink")

describe("deck identity", () => {
  it("is order-independent", () => {
    expect(deckKey({ commanderName: "Tymna the Weaver", partnerName: "Thrasios, Triton Hero" })).toBe(
      deckKey({ commanderName: "Thrasios, Triton Hero", partnerName: "Tymna the Weaver" })
    )
  })

  it("puts a Background last regardless of name", () => {
    expect(
      deckKey({
        commanderName: "Candlekeep Sage",
        commanderTypeLine: "Legendary Enchantment — Background",
        partnerName: "Wilson, Refined Grizzly",
      })
    ).toBe("Wilson, Refined Grizzly + Candlekeep Sage")
  })

  it("is the plain commander name for a solo commander", () => {
    expect(deckKey({ commanderName: "Atraxa, Praetors' Voice" })).toBe("Atraxa, Praetors' Voice")
    expect(deckKey({ commanderName: "Atraxa, Praetors' Voice", partnerName: "  " })).toBe("Atraxa, Praetors' Voice")
  })

  it("keeps double-faced names intact and splits back into halves", () => {
    const key = deckKey({ commanderName: "Esika, God of the Pantheon // The Prismatic Bridge" })
    expect(splitDeckKey(key)).toEqual(["Esika, God of the Pantheon // The Prismatic Bridge"])
    expect(splitDeckKey("Tymna the Weaver + Thrasios, Triton Hero")).toEqual(["Tymna the Weaver", "Thrasios, Triton Hero"])
  })

  it("labels in entered order with a fallback", () => {
    expect(deckLabel({ commanderName: "Tymna", partnerName: "Thrasios" })).toBe("Tymna + Thrasios")
    expect(deckLabel({}, "Unknown")).toBe("Unknown")
  })

  it("unions both halves' colors in WUBRG order", () => {
    expect(deckColorIdentity({ commanderColorIdentity: ["W", "B"], partnerColorIdentity: ["U", "G"] })).toEqual(["W", "U", "B", "G"])
  })
})

describe("pairing rules", () => {
  it("reads each pairing ability from oracle text and type line", () => {
    expect(pairingAbility(tymna)).toEqual({ kind: "partner" })
    expect(pairingAbility(pir)).toEqual({ kind: "partner-with", name: "Toothy, Imaginary Friend" })
    expect(pairingAbility(wilson)).toEqual({ kind: "choose-background" })
    expect(pairingAbility(background)).toEqual({ kind: "background" })
    expect(pairingAbility(doctor)).toEqual({ kind: "doctor" })
    expect(pairingAbility(rose)).toEqual({ kind: "doctors-companion" })
    expect(pairingAbility(ff)).toEqual({ kind: "friends-forever" })
    expect(pairingAbility(group)).toEqual({ kind: "partner-group", group: "Assassin" })
    expect(pairingAbility(plain)).toEqual({ kind: "none" })
  })

  const legal = (a: ScryfallCard, b: ScryfallCard) =>
    isLegalPairing({ name: a.name, ability: pairingAbility(a) }, { name: b.name, ability: pairingAbility(b) })

  it("accepts legal pairings in either order", () => {
    expect(legal(tymna, thrasios)).toBe(true)
    expect(legal(pir, toothy)).toBe(true)
    expect(legal(toothy, pir)).toBe(true)
    expect(legal(wilson, background)).toBe(true)
    expect(legal(background, wilson)).toBe(true)
    expect(legal(doctor, rose)).toBe(true)
    expect(legal(ff, ff2)).toBe(true)
  })

  it("rejects mismatched pairings", () => {
    expect(legal(tymna, pir)).toBe(false)
    expect(legal(tymna, background)).toBe(false)
    expect(legal(ff, tymna)).toBe(false)
    expect(legal(plain, tymna)).toBe(false)
    expect(legal(doctor, doctor)).toBe(false)
  })

  it("names the second slot from the first commander", () => {
    expect(secondSlotLabel(pairingAbility(wilson))).toBe("Background")
    expect(secondSlotLabel(pairingAbility(tymna))).toBe("Partner")
    expect(secondSlotLabel(pairingAbility(rose))).toBe("Doctor")
    expect(secondSlotLabel(null)).toBe("Second commander")
  })

  it("builds a browse query for every pairable commander", () => {
    expect(pairingSearchQuery(pairingAbility(wilson))).toContain("t:background")
    expect(pairingSearchQuery(pairingAbility(pir))).toBe('!"Toothy, Imaginary Friend"')
    expect(pairingSearchQuery(pairingAbility(plain))).toBeNull()
  })

  it("never treats a Background as a commander damage source", () => {
    expect(partnerDealsCommanderDamage({ commanderName: "Tymna", partnerName: "Thrasios" })).toBe(true)
    expect(
      partnerDealsCommanderDamage({ commanderName: "Wilson", partnerName: "Candlekeep Sage", partnerTypeLine: "Legendary Enchantment — Background" })
    ).toBe(false)
    expect(partnerDealsCommanderDamage({ commanderName: "Atraxa" })).toBe(false)
  })
})
