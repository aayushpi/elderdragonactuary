/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { MemoryRouter } from "react-router-dom"
import type { AdminUsage } from "@/lib/adminStats"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mockFetchIsAdmin = vi.fn()
const mockFetchAdminUsage = vi.fn()

vi.mock("@/lib/adminStats", () => ({
  fetchIsAdmin: () => mockFetchIsAdmin(),
  fetchAdminUsage: () => mockFetchAdminUsage(),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "admin@example.com" }, loading: false }),
}))

import { AdminPage } from "@/pages/AdminPage"

const DAY = 86_400_000

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY).toISOString()
}

const usage: AdminUsage = {
  accounts: [
    {
      userId: "u1",
      email: "active@example.com",
      signedUpAt: iso(90),
      lastSignInAt: iso(0),
      emailConfirmed: true,
      gamesLogged: 12,
      firstGameAt: iso(80),
      lastGameAt: iso(2),
      lastLoggedAt: iso(2),
      activeDays: 7,
      gamesLast7d: 3,
      gamesLast30d: 9,
      avgPodSize: 3.8,
      avgWinTurn: 9.4,
      wins: 5,
      winRate: 5 / 12,
      daysSinceLastGame: 2,
    },
    {
      userId: "u2",
      email: "neverlogged@example.com",
      signedUpAt: iso(10),
      lastSignInAt: iso(9),
      emailConfirmed: false,
      gamesLogged: 0,
      firstGameAt: null,
      lastGameAt: null,
      lastLoggedAt: null,
      activeDays: 0,
      gamesLast7d: 0,
      gamesLast30d: 0,
      avgPodSize: null,
      avgWinTurn: null,
      wins: 0,
      winRate: null,
      daysSinceLastGame: null,
    },
  ],
  totals: {
    totalAccounts: 2,
    accountsWithGames: 1,
    active7d: 1,
    active30d: 1,
    newAccounts30d: 1,
    totalGames: 12,
    games7d: 3,
    games30d: 9,
    medianGamesPerAccount: 6,
  },
}

async function mount() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    )
  })
  return container
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AdminPage", () => {
  it("renders per-account usage and headline totals for an admin", async () => {
    mockFetchIsAdmin.mockResolvedValue(true)
    mockFetchAdminUsage.mockResolvedValue(usage)

    const container = await mount()
    const text = container.textContent ?? ""

    expect(text).toContain("active@example.com")
    expect(text).toContain("neverlogged@example.com")
    // Games logged, active days, and last-game recency all surface.
    expect(text).toContain("12")
    expect(text).toContain("2d ago")
    // 5 of 12 wins rounds to 42%.
    expect(text).toContain("42%")
    // Totals row.
    expect(text).toContain("Accounts")
    expect(text).toContain("50% logged a game")
  })

  it("shows an account that never logged a game as 'never' rather than blank", async () => {
    mockFetchIsAdmin.mockResolvedValue(true)
    mockFetchAdminUsage.mockResolvedValue(usage)

    const container = await mount()
    expect(container.textContent).toContain("never")
  })

  it("refuses to render usage for a non-admin and never requests it", async () => {
    mockFetchIsAdmin.mockResolvedValue(false)

    const container = await mount()

    expect(container.textContent).toContain("only available to administrators")
    expect(mockFetchAdminUsage).not.toHaveBeenCalled()
  })

  it("surfaces a load failure instead of rendering an empty roster", async () => {
    mockFetchIsAdmin.mockResolvedValue(true)
    mockFetchAdminUsage.mockRejectedValue(new Error("Admin privileges required."))

    const container = await mount()
    expect(container.textContent).toContain("Admin privileges required.")
  })
})
