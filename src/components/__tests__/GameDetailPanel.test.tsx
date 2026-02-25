import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { GameDetailPanel } from "@/components/GameDetailPanel"
import type { Game, Player } from "@/types"

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: overrides.id ?? "player-id",
    isMe: overrides.isMe ?? false,
    commanderName: overrides.commanderName ?? "Test Commander",
    seatPosition: overrides.seatPosition ?? 1,
    fastMana: overrides.fastMana ?? { hasFastMana: false, cards: [] },
    knockoutTurn: overrides.knockoutTurn,
    commanderImageUri: overrides.commanderImageUri,
    commanderColorIdentity: overrides.commanderColorIdentity,
    commanderManaCost: overrides.commanderManaCost,
    commanderTypeLine: overrides.commanderTypeLine,
    partnerName: overrides.partnerName,
    partnerImageUri: overrides.partnerImageUri,
    partnerManaCost: overrides.partnerManaCost,
    partnerTypeLine: overrides.partnerTypeLine,
  }
}

function makeGame(players: Player[], winnerId: string): Game {
  return {
    id: "game-id",
    playedAt: "2026-02-25T00:00:00.000Z",
    players,
    winnerId,
    winTurn: 8,
  }
}

describe("GameDetailPanel history details", () => {
  it("shows KO badge for losing opponents with knockout turn", () => {
    const me = makePlayer({ id: "me", isMe: true, commanderName: "Atraxa", seatPosition: 1 })
    const opponent = makePlayer({ id: "opp1", commanderName: "Kinnan", seatPosition: 2, knockoutTurn: 6 })
    const game = makeGame([me, opponent], me.id)

    const html = renderToStaticMarkup(<GameDetailPanel game={game} />)

    expect(html).toContain("KO ON TURN 6")
  })

  it("does not render old seat label markers in opponent rows", () => {
    const me = makePlayer({ id: "me", isMe: true, commanderName: "Atraxa", seatPosition: 1 })
    const opponent = makePlayer({ id: "opp1", commanderName: "Kinnan", seatPosition: 2, knockoutTurn: 6 })
    const game = makeGame([me, opponent], me.id)

    const html = renderToStaticMarkup(<GameDetailPanel game={game} />)

    expect(html).not.toContain("#2")
  })

  it("does not show KO badge for opponent when that opponent is the winner", () => {
    const me = makePlayer({ id: "me", isMe: true, commanderName: "Atraxa", seatPosition: 1 })
    const opponentWinner = makePlayer({ id: "opp1", commanderName: "Kinnan", seatPosition: 2, knockoutTurn: 6 })
    const game = makeGame([me, opponentWinner], opponentWinner.id)

    const html = renderToStaticMarkup(<GameDetailPanel game={game} />)

    expect(html).toContain("Win")
    expect(html).not.toContain("KO ON TURN 6")
  })
})
