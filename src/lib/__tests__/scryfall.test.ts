import { describe, it, expect } from "vitest"
import { resolveArtCrop } from "@/lib/scryfall"
import type { ScryfallCard } from "@/types"

function baseCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: "test-id",
    name: "Test Card",
    mana_cost: "{2}{U}",
    color_identity: ["U"],
    type_line: "Legendary Creature",
    ...overrides,
  }
}

describe("resolveArtCrop", () => {
  it("returns art_crop when available even if larger images exist", () => {
    const card = baseCard({
      image_uris: { small: "s", normal: "n", large: "L", art_crop: "a", border_crop: "b" },
    })
    expect(resolveArtCrop(card)).toBe("a")
  })

  it("falls back to art_crop on face when main art_crop missing", () => {
    const card = baseCard({
      card_faces: [
        { image_uris: { small: "s", normal: "n", large: "FL", art_crop: "fa", border_crop: "b" } },
      ],
    })
    expect(resolveArtCrop(card)).toBe("fa")
  })

  it("falls through large → normal → small when no art_crop available", () => {
    const card2 = baseCard({
      image_uris: undefined,
      card_faces: [
        { image_uris: { small: "S", normal: "N", large: undefined as unknown as string, art_crop: undefined as unknown as string, border_crop: "B" } },
      ],
    })
    // art_crop absent everywhere; should pick face normal
    expect(resolveArtCrop(card2)).toBe("N")
  })

  it("returns undefined when no images exist at all", () => {
    const card = baseCard({ image_uris: undefined, card_faces: undefined })
    expect(resolveArtCrop(card)).toBeUndefined()
  })

  it("returns undefined when card_faces has no image_uris", () => {
    const card = baseCard({
      image_uris: undefined,
      card_faces: [{ mana_cost: "{U}" }],
    })
    expect(resolveArtCrop(card)).toBeUndefined()
  })
})
