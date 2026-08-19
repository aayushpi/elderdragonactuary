import { describe, it, expect, vi, beforeEach } from "vitest"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: (fn: string) => mockRpc(fn) },
}))

import { fetchAdminUsage, fetchIsAdmin } from "@/lib/adminStats"

/** PostgREST returns bigint/numeric as JSON strings on some versions to keep
 *  precision. The mapping layer has to absorb that or every count renders as
 *  NaN. This fixture deliberately mixes both representations. */
const usageRow = {
  user_id: "u1",
  email: "player@example.com",
  signed_up_at: "2026-01-01T00:00:00Z",
  last_sign_in_at: "2026-08-01T00:00:00Z",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  games_logged: "12",
  first_game_at: "2026-02-01T00:00:00Z",
  last_game_at: "2026-08-10T00:00:00Z",
  last_logged_at: "2026-08-10T00:00:00Z",
  active_days: "7",
  games_last_7d: 3,
  games_last_30d: "9",
  avg_pod_size: "3.80",
  avg_win_turn: 9.4,
  wins: "3",
}

const totalsRow = {
  total_accounts: "4",
  accounts_with_games: 2,
  active_7d: "1",
  active_30d: 1,
  new_accounts_30d: "2",
  total_games: "4",
  games_7d: 3,
  games_30d: "3",
  median_games_per_account: "0.5",
}

beforeEach(() => {
  mockRpc.mockReset()
})

describe("fetchAdminUsage", () => {
  it("coerces string-encoded counts into numbers", async () => {
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data: fn === "admin_account_usage" ? [usageRow] : [totalsRow],
        error: null,
      }),
    )

    const { accounts, totals } = await fetchAdminUsage()

    expect(accounts[0].gamesLogged).toBe(12)
    expect(accounts[0].activeDays).toBe(7)
    expect(accounts[0].gamesLast30d).toBe(9)
    expect(accounts[0].avgPodSize).toBe(3.8)
    expect(totals.totalAccounts).toBe(4)
    expect(totals.medianGamesPerAccount).toBe(0.5)
  })

  it("computes win rate, and leaves it null when there is nothing to divide", async () => {
    mockRpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data:
          fn === "admin_account_usage"
            ? [usageRow, { ...usageRow, user_id: "u2", games_logged: "0", wins: "0", last_game_at: null }]
            : [totalsRow],
        error: null,
      }),
    )

    const { accounts } = await fetchAdminUsage()

    expect(accounts[0].winRate).toBeCloseTo(0.25)
    // Not 0 — "never logged a game" and "never won" must not render alike.
    expect(accounts[1].winRate).toBeNull()
    expect(accounts[1].daysSinceLastGame).toBeNull()
  })

  it("throws when the RPC reports an error rather than returning an empty roster", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "Admin privileges required." } })

    await expect(fetchAdminUsage()).rejects.toThrow("Admin privileges required.")
  })
})

describe("fetchIsAdmin", () => {
  it("resolves false when the check errors, so the route just stays hidden", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "nope" } })
    expect(await fetchIsAdmin()).toBe(false)
  })

  it("requires an explicit true, not merely a truthy value", async () => {
    mockRpc.mockResolvedValue({ data: "yes", error: null })
    expect(await fetchIsAdmin()).toBe(false)

    mockRpc.mockResolvedValue({ data: true, error: null })
    expect(await fetchIsAdmin()).toBe(true)
  })
})
