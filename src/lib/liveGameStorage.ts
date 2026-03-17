import type { LiveGameSession } from "@/types"

function getStorageKey(userId: string) {
  return `commando_live_game:${userId}`
}

export function loadLiveGameSession(userId: string): LiveGameSession | null {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    return raw ? (JSON.parse(raw) as LiveGameSession) : null
  } catch {
    return null
  }
}

export function saveLiveGameSession(userId: string, session: LiveGameSession): void {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(session))
}

export function clearLiveGameSession(userId: string): void {
  localStorage.removeItem(getStorageKey(userId))
}
