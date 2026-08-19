/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { MemoryRouter } from "react-router-dom"
import type { Game } from "@/types"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const captured: Array<[string, unknown]> = []

vi.mock("@/lib/analytics", () => ({
  capture: (event: string, props?: unknown) => captured.push([event, props]),
  setPersonProperties: vi.fn(),
  initAnalytics: vi.fn(),
  isAnalyticsEnabled: () => false,
  capturePageview: vi.fn(),
  identifyUser: vi.fn(),
  resetIdentity: vi.fn(),
}))

const addGame = vi.fn(async () => {})

vi.mock("@/hooks/useGames", () => ({
  useGames: () => ({
    games: [],
    loading: false,
    addGame,
    updateGame: vi.fn(),
    deleteGame: vi.fn(),
    getGame: vi.fn(),
    replaceGames: vi.fn(),
    clearGames: vi.fn(),
  }),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com" },
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

// The log flow's own form is not what's under test — this stands in for it so
// the test can trigger a save and a cancel directly.
vi.mock("@/pages/LogGamePage", () => ({
  LogGamePage: ({ onSave, onCancel }: { onSave: (g: Game) => void; onCancel: () => void }) => (
    <div>
      <button data-testid="save" onClick={() => onSave(makeGame())} />
      <button data-testid="cancel" onClick={onCancel} />
    </div>
  ),
}))

import App from "@/App"

function makeGame(): Game {
  return {
    id: "g1",
    playedAt: new Date().toISOString(),
    winnerId: "p1",
    winTurn: 8,
    players: [
      { id: "p1", isMe: true, commanderName: "Atraxa", seatPosition: 1, fastMana: { hasFastMana: false, cards: [] } },
      { id: "p2", isMe: false, commanderName: "Krenko", seatPosition: 2, fastMana: { hasFastMana: false, cards: [] } },
    ],
  }
}

async function mountApp() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    )
  })
  return container
}

/** The "n" shortcut is the least brittle way to open the log flow — it does not
 *  depend on which button happens to be first on the dashboard. */
async function pressN() {
  await act(async () => {
    // Dispatched on body, as a real key event would be: the handler inspects
    // event.target to ignore keystrokes typed into form fields.
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }))
  })
}

async function click(container: HTMLElement, selector: string) {
  const el = container.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`no element for ${selector}`)
  await act(async () => {
    el.click()
  })
}

beforeEach(() => {
  captured.length = 0
  addGame.mockClear()
})

const names = () => captured.map(([event]) => event)

describe("log-game analytics", () => {
  it("captures game_logged on save and does NOT also capture an abandon", async () => {
    const container = await mountApp()

    await pressN()
    // Opening the flow is what emits game_log_started — including via the
    // keyboard shortcut, which must not be a hole in the funnel.
    expect(names()).toContain("game_log_started")

    await click(container, '[data-testid="save"]')

    expect(addGame).toHaveBeenCalledTimes(1)
    expect(names()).toContain("game_logged")
    // The save path also closes the flow. Counting that as an abandon would
    // make the abandonment metric meaningless.
    expect(names()).not.toContain("game_log_abandoned")
  })

  it("captures game_log_abandoned when the flow is cancelled instead", async () => {
    const container = await mountApp()

    await pressN()
    await click(container, '[data-testid="cancel"]')

    expect(names()).toContain("game_log_abandoned")
    expect(names()).not.toContain("game_logged")
  })
})
