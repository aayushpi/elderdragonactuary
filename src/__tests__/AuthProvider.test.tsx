/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"

// ── Supabase stub (hoisted so vi.mock factory can reference them) ──────
const { mockSignUp, mockSignIn, mockSignOut } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
  },
}))

import { useAuth } from "@/hooks/useAuth"
import { AuthProvider } from "@/providers/AuthProvider"

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AuthProvider — signUp", () => {
  it("returns null error on successful signup", async () => {
    mockSignUp.mockResolvedValueOnce({ error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.signUp("a@b.com", "pass123", "BOLT THE BIRD")
    })

    expect(res?.error).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pass123",
      options: { data: { invite_code: "BOLT THE BIRD" } },
    })
  })

  it("surfaces Supabase error message on regular failure", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: { message: "User already registered" },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.signUp("a@b.com", "pass123", "BOLT THE BIRD")
    })

    expect(res?.error).toBe("User already registered")
  })

  it("translates opaque 'database error' into a friendly message", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: { message: "Database error saving new user" },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.signUp("a@b.com", "pass123", "CODE")
    })

    expect(res?.error).toMatch(/double-check your invite code/i)
  })
})

describe("AuthProvider — signIn", () => {
  it("returns null error on successful sign-in", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.signIn("a@b.com", "pass123")
    })

    expect(res?.error).toBeNull()
  })

  it("returns error message on failed sign-in", async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.signIn("a@b.com", "wrong")
    })

    expect(res?.error).toBe("Invalid login credentials")
  })
})
