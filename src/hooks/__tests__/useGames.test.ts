import { beforeEach, describe, expect, it, vi } from "vitest"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    setGames: vi.fn(),
    setLoading: vi.fn(),
    fetchGames: vi.fn(),
    insertGame: vi.fn(),
    patchGame: vi.fn(),
    removeGame: vi.fn(),
    replaceAllGames: vi.fn(),
    parseImportJson: vi.fn(),
  },
}))

let authState: { user: { id: string } | null; loading: boolean }

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")
  return {
    ...actual,
    useState: <T,>(initial: T) => {
      if (Array.isArray(initial)) return [initial, mocks.setGames] as const
      return [initial, mocks.setLoading] as const
    },
    useEffect: (effect: () => void | (() => void)) => {
      effect()
    },
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  }
})

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}))

vi.mock("@/lib/supabaseStorage", () => ({
  fetchGames: mocks.fetchGames,
  insertGame: mocks.insertGame,
  patchGame: mocks.patchGame,
  removeGame: mocks.removeGame,
  replaceAllGames: mocks.replaceAllGames,
}))

vi.mock("@/lib/storage", () => ({
  parseImportJson: mocks.parseImportJson,
}))

import { useGames } from "@/hooks/useGames"

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe("useGames auth-aware fetching", () => {
  beforeEach(() => {
    authState = { user: null, loading: true }
    mocks.setGames.mockClear()
    mocks.setLoading.mockClear()
    mocks.fetchGames.mockReset()
    mocks.insertGame.mockReset()
    mocks.patchGame.mockReset()
    mocks.removeGame.mockReset()
    mocks.replaceAllGames.mockReset()
    mocks.parseImportJson.mockReset()
  })

  it("does not fetch while auth is still loading", () => {
    useGames()

    expect(mocks.setLoading).toHaveBeenCalledWith(true)
    expect(mocks.fetchGames).not.toHaveBeenCalled()
  })

  it("clears local games when signed out", () => {
    authState = { user: null, loading: false }

    useGames()

    expect(mocks.fetchGames).not.toHaveBeenCalled()
    expect(mocks.setGames).toHaveBeenCalledWith([])
    expect(mocks.setLoading).toHaveBeenCalledWith(false)
  })

  it("fetches games once auth user is available", async () => {
    authState = { user: { id: "user-123" }, loading: false }
    mocks.fetchGames.mockResolvedValueOnce([{ id: "g1" }])

    useGames()
    await flushPromises()

    expect(mocks.fetchGames).toHaveBeenCalledTimes(1)
    expect(mocks.setGames).toHaveBeenCalledWith([{ id: "g1" }])
    expect(mocks.setLoading).toHaveBeenCalledWith(true)
    expect(mocks.setLoading).toHaveBeenCalledWith(false)
  })
})
