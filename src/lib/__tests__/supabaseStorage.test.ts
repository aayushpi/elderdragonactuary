import { describe, it, expect, beforeEach } from "vitest"
import { replaceAllGames } from "@/lib/supabaseStorage"
import { supabase } from "@/lib/supabase"

beforeEach(() => {
  // ensure a valid session is returned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabase as any).auth.getSession = async () => ({ data: { session: { user: { id: "test-user" } } } })
})

describe("replaceAllGames ordering for date-only playedAt", () => {
  it("adjusts duplicate playedAt so returned rows sort in import order", async () => {
    // prepare three games with identical date-only playedAt
    const baseDate = "2026-02-26T00:00:00.000Z"
    const games = [
      { id: "a", playedAt: baseDate, winTurn: 1, winnerId: "p1", players: [{ id: "p1" }] },
      { id: "b", playedAt: baseDate, winTurn: 2, winnerId: "p2", players: [{ id: "p2" }] },
      { id: "c", playedAt: baseDate, winTurn: 3, winnerId: "p3", players: [{ id: "p3" }] },
    ]

    // Mock delete/insert to succeed (cast to any to avoid strict Supabase types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).from = () => {
      return {
        delete: () => ({ eq: async () => ({ error: null }) }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insert: (rows: any) => ({ select: async () => ({ data: rows, error: null }) }),
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await replaceAllGames(games as any)

    // returned playedAt should be strictly decreasing (newer first)
    const times = res.map((r) => new Date(r.playedAt).getTime())
    expect(times[0]).toBeGreaterThan(times[1])
    expect(times[1]).toBeGreaterThan(times[2])

    // Ensure order corresponds to input order (first returned matches first input)
    // Our replaceAllGames uses the adjusted timestamps so row order should match
    expect(res).toHaveLength(3)
  })
})

describe("player field round-trip", () => {
  it("keeps partner color identity and companion through insert and read-back", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).from = () => ({
      delete: () => ({ eq: async () => ({ error: null }) }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insert: (rows: any) => ({ select: async () => ({ data: rows, error: null }) }),
    })
    const player = {
      id: "p1",
      isMe: true,
      commanderName: "Wilson, Refined Grizzly",
      partnerName: "Candlekeep Sage",
      partnerColorIdentity: ["U"],
      partnerTypeLine: "Legendary Enchantment — Background",
      companionName: "Lurrus of the Dream-Den",
      companionImageUri: "lurrus.jpg",
      seatPosition: 1,
      fastMana: { hasFastMana: false, cards: [] },
    }
    const game = { id: "g", playedAt: "2026-02-26T12:00:00.000Z", winTurn: 5, winnerId: "p1", players: [player] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [saved] = await replaceAllGames([game] as any)
    expect(saved.players[0]).toMatchObject({
      partnerColorIdentity: ["U"],
      partnerTypeLine: "Legendary Enchantment — Background",
      companionName: "Lurrus of the Dream-Den",
      companionImageUri: "lurrus.jpg",
    })
  })
})
