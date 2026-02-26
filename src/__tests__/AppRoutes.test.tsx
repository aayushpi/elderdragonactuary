import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import App from "@/App"
import type { Game } from "@/types"

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

  it("renders history page on /history", () => {
    const html = renderPath("/history")
    expect(html).toContain("No games yet.")
  })

  it("renders settings page on /settings", () => {
    const html = renderPath("/settings")
    expect(html).toContain("Export games")
  })
})