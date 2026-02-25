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
  it("returns image_uris.large when available", () => {
    const card = baseCard({
      image_uris: { small: "s", normal: "n", large: "L", art_crop: "a", border_crop: "b" },
    })
    expect(resolveArtCrop(card)).toBe("L")
  })

  it("falls back to card_faces[0].image_uris.large", () => {
    const card = baseCard({
      card_faces: [
        { image_uris: { small: "s", normal: "n", large: "FL", art_crop: "a", border_crop: "b" } },
      ],
    })
    expect(resolveArtCrop(card)).toBe("FL")
  })

  it("falls through large → normal → small → art_crop", () => {
    const card2 = baseCard({
      image_uris: undefined,
      card_faces: [
        { image_uris: { small: "S", normal: "N", large: undefined as unknown as string, art_crop: "A", border_crop: "B" } },
      ],
    })
    // large is undefined → falls to normal of main (undefined) → face normal "N" via the chain
    // Actually looking at the code: it checks image_uris?.large, then card_faces?.[0]?.image_uris?.large,
    // then image_uris?.normal, then card_faces?.[0]?.image_uris?.normal...
    // With no image_uris on main card and face large=undefined: skips both larges, tries main normal (undef), face normal = "N"
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
