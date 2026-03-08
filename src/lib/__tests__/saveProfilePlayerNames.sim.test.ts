import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock supabase client used by storage.ts. Create mocks inside factory
// to avoid vi.mock hoisting issues, and expose them on globalThis for assertions.
vi.mock('@/lib/supabase', () => {
  const mockUpdateUser = vi.fn(async (_args: unknown) => ({ data: null, error: null }))
  const mockUpsert = vi.fn(async (vals: unknown) => ({ data: vals, error: null }))
  // Expose mocks for test assertions
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - test-only global attachment
  globalThis.__TEST_MOCKS = { mockUpdateUser, mockUpsert }
  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: { id: 'test-user-123' } } }),
        updateUser: mockUpdateUser,
      },
      from: (_table: string) => ({ upsert: mockUpsert }),
    },
  }
})

import { saveProfilePlayerNames } from '@/lib/storage'

// Minimal localStorage polyfill for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {}
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - test helper
  globalThis.localStorage = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
  }
}

describe('saveProfilePlayerNames (simulate)', () => {
  beforeEach(() => {
    const m = (globalThis as any).__TEST_MOCKS
    m.mockUpdateUser.mockClear()
    m.mockUpsert.mockClear()
    localStorage.clear()
  })

  it('persists locally and calls supabase update/upsert', async () => {
    saveProfilePlayerNames(['Andy'])
    // wait for background async IIFE to run
    await new Promise((r) => setTimeout(r, 100))

    // localStorage should have the profile
    const raw = localStorage.getItem('commando_profile')
    expect(raw).toBeTruthy()
    const profile = JSON.parse(raw as string)
    expect(profile.playerNames).toContain('Andy')

    // Supabase auth.updateUser should have been called OR from().upsert
    const m = (globalThis as any).__TEST_MOCKS
    expect(m.mockUpdateUser.mock.calls.length + m.mockUpsert.mock.calls.length).toBeGreaterThan(0)
  })
})
