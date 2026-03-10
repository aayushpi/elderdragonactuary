import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user-123' } } }),
    },
  },
}))

import { saveProfilePlayerNames } from '@/lib/storage'

// Minimal localStorage polyfill for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {}
  // @ts-expect-error - test helper
  globalThis.localStorage = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
  }
}

describe('saveProfilePlayerNames', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists player names to localStorage profile', () => {
    saveProfilePlayerNames(['Andy', 'Beth'])

    const raw = localStorage.getItem('commando_profile')
    expect(raw).toBeTruthy()
    const profile = JSON.parse(raw as string)
    expect(profile.playerNames).toEqual(['Andy', 'Beth'])
  })

  it('trims and filters empty names', () => {
    saveProfilePlayerNames(['  Andy  ', '', '  '])

    const raw = localStorage.getItem('commando_profile')
    expect(raw).toBeTruthy()
    const profile = JSON.parse(raw as string)
    expect(profile.playerNames).toEqual(['Andy'])
  })

  it('removes playerNames when all names are empty', () => {
    saveProfilePlayerNames(['Andy'])
    saveProfilePlayerNames(['', '  '])

    const raw = localStorage.getItem('commando_profile')
    expect(raw).toBeTruthy()
    const profile = JSON.parse(raw as string)
    expect(profile.playerNames).toBeUndefined()
  })
})
