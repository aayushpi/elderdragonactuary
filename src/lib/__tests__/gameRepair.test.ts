import { describe, it, expect, vi } from "vitest"
import { needsRepair, repairGamePlayers } from "@/lib/gameRepair"
import { makeGame, makePlayer } from "./helpers"
import type { ScryfallCard } from "@/types"

const sage: ScryfallCard = {
  id: "sage",
  name: "Candlekeep Sage",
  mana_cost: "{1}{U}",
  color_identity: ["U"],
  type_line: "Legendary Enchantment — Background",
  image_uris: { small: "s", normal: "n", large: "l", art_crop: "sage-art", border_crop: "b" },
}

describe("repairGamePlayers", () => {
  it("fills a partner's missing color identity, art and type line", async () => {
    const me = makePlayer({ isMe: true, commanderName: "Wilson", partnerName: "Candlekeep Sage" })
    const game = makeGame({ players: [{ ...me, commanderImageUri: "w.jpg" }, makePlayer()] })
    expect(needsRepair(game)).toBe(true)
    const lookup = vi.fn().mockResolvedValue(sage)
    const players = await repairGamePlayers(game, lookup)
    expect(lookup).toHaveBeenCalledWith("Candlekeep Sage")
    expect(players?.[0]).toMatchObject({
      partnerColorIdentity: ["U"],
      partnerImageUri: "sage-art",
      partnerTypeLine: "Legendary Enchantment — Background",
    })
  })

  it("returns null when lookups fail", async () => {
    const me = makePlayer({ isMe: true, commanderName: "Wilson", partnerName: "Homebrew Friend" })
    const game = makeGame({ players: [{ ...me, commanderImageUri: "w.jpg" }] })
    expect(await repairGamePlayers(game, () => Promise.reject(new Error("nope")))).toBeNull()
  })

  it("leaves complete games alone", () => {
    const me = makePlayer({ isMe: true, commanderName: "Atraxa" })
    expect(needsRepair(makeGame({ players: [{ ...me, commanderImageUri: "a.jpg" }, makePlayer()] }))).toBe(false)
  })
})
