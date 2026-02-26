import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import App from "@/App"
import type { Game, Player } from "@/types"

type UseGamesReturn = {
  games: Game[]
  addGame: (game: Game) => void
  updateGame: (id: string, patch: Partial<Game>) => void
  deleteGame: (id: string) => void
  getGame: (id: string) => Game | undefined
  replaceGames: (json: string) => { success: boolean; count: number; error?: string }
  clearGames: () => void
}

const mockUseGamesState: UseGamesReturn = {
  games: [],
  addGame: vi.fn(),
  updateGame: vi.fn(),
  deleteGame: vi.fn(),
  getGame: vi.fn(),
  replaceGames: vi.fn(() => ({ success: true, count: 0 })),
  clearGames: vi.fn(),
}

vi.mock("@/hooks/useGames", () => ({
  useGames: () => mockUseGamesState,
}))

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

function makeGame(overrides: Partial<Game> = {}): Game {
  const me = makePlayer({ id: "me", isMe: true, commanderName: "Atraxa", seatPosition: 1 })
  const opp = makePlayer({ id: "opp", commanderName: "Kinnan", seatPosition: 2 })

  return {
    id: overrides.id ?? "game-1",
    playedAt: overrides.playedAt ?? "2026-02-25T00:00:00.000Z",
    players: overrides.players ?? [me, opp],
    winnerId: overrides.winnerId ?? "me",
    winTurn: overrides.winTurn ?? 8,
    notes: overrides.notes,
    winConditions: overrides.winConditions,
    keyWinconCards: overrides.keyWinconCards,
    bracket: overrides.bracket,
  }
}

function renderPath(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

describe("App routing smoke tests", () => {
  beforeEach(() => {
    mockUseGamesState.games = []
    mockUseGamesState.getGame = vi.fn(() => undefined)
  })

  it("renders stats page on /", () => {
    const html = renderPath("/")
    expect(html).toContain("No games logged yet.")
  })

  it("renders log game page on /log-game", () => {
    const html = renderPath("/log-game")
    expect(html).toContain("How many players?")
  })

  it("renders history page on /history", () => {
    const html = renderPath("/history")
    expect(html).toContain("No games yet.")
  })

  it("renders settings page on /settings", () => {
    const html = renderPath("/settings")
    expect(html).toContain("Export games")
  })

  it("renders edit page on /history/:gameId/edit when game exists", () => {
    const game = makeGame({ id: "game-123" })
    mockUseGamesState.games = [game]
    mockUseGamesState.getGame = vi.fn((id: string) => (id === "game-123" ? game : undefined))

    const html = renderPath("/history/game-123/edit")
    expect(html).toContain("Edit Game")
  })

})