import type { Game, Player } from "@/types"
import { supabase } from "@/lib/supabase"

// Minimal runtime shape for the supabase client we interact with here.
type AuthLike = {
  getUser?: () => Promise<{ data: { user?: { id?: string; user_metadata?: unknown } } }>;
  updateUser?: (args: { data: Record<string, unknown> }) => Promise<unknown>;
}

type FromQuery = {
  select: (cols?: string) => { eq: (col: string, val: unknown) => { single: () => Promise<{ data: unknown }> } }
  upsert?: (values: unknown) => Promise<unknown>
  insert?: (values: unknown) => Promise<unknown>
}

type SupabaseLike = {
  auth?: AuthLike
  from?: (table: string) => FromQuery
}

const sb = supabase as unknown as SupabaseLike
const STORAGE_KEY = "commando_games"
const PODS_KEY = "commando_pods"
const PROFILE_KEY = "commando_profile"

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function loadGames(): Game[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Game[]) : []
  } catch {
    return []
  }
}

export function saveGames(games: Game[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}

// ── Export ────────────────────────────────────────────────────────────────────

interface ExportPlayer {
  commanderName: string
  commanderManaCost?: string
  commanderTypeLine?: string
  commanderColorIdentity?: string[]
  commanderImageUri?: string
  partnerName?: string
  partnerManaCost?: string
  partnerTypeLine?: string
  partnerImageUri?: string
  knockoutTurn?: number
  seatPosition: number
  fastMana: { hasFastMana: boolean; cards: string[] }
}

interface ExportGame {
  playedAt: string        // YYYY-MM-DD
  winTurn: number
  winnerIndex: number     // index into players array (0 = you)
  notes?: string
  winConditions?: string[]
  keyWinconCards?: string[]
  bracket?: number        // 1-5, optional power level bracket
  podId?: string
  players: ExportPlayer[]
}

interface ExportFile {
  exportedAt: string
  games: ExportGame[]
  pods?: Pod[]
}

export function exportData(): string {
  const games = loadGames()

  const exportGames: ExportGame[] = games.map((g) => {
    const winnerIndex = g.players.findIndex((p) => p.id === g.winnerId)
    return {
      playedAt: g.playedAt.slice(0, 10),
      winTurn: g.winTurn,
      winnerIndex: winnerIndex >= 0 ? winnerIndex : 0,
      notes: g.notes,
      winConditions: g.winConditions,
      keyWinconCards: g.keyWinconCards,
      bracket: g.bracket,
      podId: g.podId,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      players: g.players.map(({ id: _id, isMe: _isMe, ...rest }) => rest as ExportPlayer),
    }
  })

  const file: ExportFile = {
    exportedAt: new Date().toISOString().slice(0, 10),
    games: exportGames,
    pods: loadPods(),
  }

  return JSON.stringify(file, null, 2)
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function exportCSV(): string {
  const file = JSON.parse(exportData()) as { exportedAt: string; games: ExportGame[] }

  // Determine the maximum number of players across all games so columns are consistent
  const maxPlayers = file.games.reduce((m, g) => Math.max(m, g.players.length), 0)

  const headers: string[] = []
  headers.push("Date")
  headers.push("Bracket")
  for (let i = 1; i <= maxPlayers; i++) {
    headers.push(`Player ${i} Commander`)
    headers.push(`Player ${i} Fast Mana`)
    headers.push(`Player ${i} KO Turn`)
  }
  headers.push("Winner")
  headers.push("Win Turn")
  headers.push("Notes")
  headers.push("Win Conditions")
  headers.push("Key Wincon Cards")

  const rows: string[] = []
  rows.push(headers.join(','))

  file.games.forEach((g) => {
    const row: string[] = []
    row.push(g.playedAt)
    row.push(g.bracket ? String(g.bracket) : "")

    for (let i = 0; i < maxPlayers; i++) {
      const p = g.players[i]
      if (p) {
        // Combine commander and partner names if partner exists
        const commanderDisplay = p.partnerName 
          ? `${p.commanderName ?? ""} // ${p.partnerName}`
          : (p.commanderName ?? "")
        row.push(commanderDisplay)
        const hasFast = p.fastMana?.hasFastMana
        const fastVal = hasFast ? (Array.isArray(p.fastMana?.cards) ? p.fastMana!.cards.join(', ') : '') : "No"
        row.push(fastVal)
        row.push(typeof p.knockoutTurn === "number" ? String(p.knockoutTurn) : "")
      } else {
        row.push("")
        row.push("")
        row.push("")
      }
    }

    const winnerName = typeof g.winnerIndex === "number" && g.players[g.winnerIndex]
      ? (g.players[g.winnerIndex].partnerName 
          ? `${g.players[g.winnerIndex].commanderName ?? ""} // ${g.players[g.winnerIndex].partnerName}`
          : (g.players[g.winnerIndex].commanderName ?? ""))
      : ""
    row.push(winnerName)
    row.push(String(g.winTurn ?? ""))
    row.push(g.notes ?? "")
    row.push(g.winConditions?.join(", ") ?? "")
    row.push(g.keyWinconCards?.join(", ") ?? "")

    rows.push(row.map(csvEscape).join(','))
  })

  return rows.join('\n')
}

// ------------------ Pods & Profile helpers ------------------

import type { Pod } from "@/types"

export function loadPods(): Pod[] {
  try {
    const raw = localStorage.getItem(PODS_KEY)
    return raw ? (JSON.parse(raw) as Pod[]) : []
  } catch {
    return []
  }
}

export function savePods(pods: Pod[]): void {
  localStorage.setItem(PODS_KEY, JSON.stringify(pods))
}

function generatePodId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function createPodIfMissing(playerNames: string[]): Pod | null {
  const trimmed = playerNames.map((n) => (n ?? "").trim())
  if (trimmed.length === 0) return null
  if (trimmed.some((n) => !n)) return null

  const existing = loadPods()
  // simple duplicate detection by exact sequence
  const found = existing.find((p) => p.players.length === trimmed.length && p.players.every((v, i) => v === trimmed[i]))
  if (found) return found

  const pod: Pod = {
    id: generatePodId(),
    players: trimmed,
    label: trimmed.join(", "),
    createdAt: new Date().toISOString(),
  }
  const next = [...existing, pod]
  savePods(next)
  return pod
}

export function loadProfile(): { displayName?: string; playerNames?: string[] } {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    const local = raw ? (JSON.parse(raw) as { displayName?: string; playerNames?: string[] }) : {}
    // Fire-and-forget: attempt to refresh profile from cloud
    ;(async function fetchRemote() {
      try {
        // Try to read user metadata first
        if (sb.auth && typeof sb.auth.getUser === 'function') {
          const resp = await sb.auth.getUser!()
          const remoteUser = resp?.data?.user
          const remoteMeta = remoteUser?.user_metadata ?? undefined
          if (remoteMeta && Array.isArray((remoteMeta as Record<string, unknown>).player_names)) {
            const remoteList = (remoteMeta as Record<string, unknown>).player_names as unknown[]
            const merged = { ...local, playerNames: remoteList.map(String) }
            localStorage.setItem(PROFILE_KEY, JSON.stringify(merged))
            try {
              const ev = new CustomEvent("profile:updated", { detail: { displayName: merged.displayName, playerNames: merged.playerNames } })
              window.dispatchEvent(ev)
            } catch (err) { void err }
            return
          }
        }

        // Fallback: try to fetch from `profiles` table if available
        if (typeof sb.from === 'function' && sb.auth && typeof sb.auth.getUser === 'function') {
          const userResp = await sb.auth.getUser!()
          const userId = userResp?.data?.user?.id
          if (userId) {
            const { data } = await sb.from!('profiles').select('player_names,display_name').eq('id', userId).single()
            if (data) {
              const d = data as Record<string, unknown>
              const remoteNames = Array.isArray(d.player_names) ? (d.player_names as unknown[]).map(String) : undefined
              const remoteDisplay = typeof d.display_name === 'string' ? d.display_name : undefined
              const merged = { ...local, displayName: remoteDisplay ?? local.displayName, playerNames: remoteNames ?? local.playerNames }
              localStorage.setItem(PROFILE_KEY, JSON.stringify(merged))
              try {
                const ev = new CustomEvent("profile:updated", { detail: { displayName: merged.displayName, playerNames: merged.playerNames } })
                window.dispatchEvent(ev)
              } catch (err) { void err }
            }
          }
        }
      } catch (err) {
        void err
      }
    })()

    return local
  } catch {
    return {}
  }
}

export function saveProfileDisplayName(name: string | undefined): void {
  try {
    const cur = loadProfile()
    const next = { ...cur, displayName: name?.trim() || undefined }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    try {
      const ev = new CustomEvent("profile:updated", { detail: { displayName: next.displayName, playerNames: next.playerNames } })
      window.dispatchEvent(ev)
    } catch (err) {
      void err
    }
    // best-effort: persist to cloud
    ;(async function persist() {
      try {
        if (!sb.auth || typeof sb.auth.getUser !== 'function') return
        const userResp = await sb.auth.getUser!()
        const user = userResp?.data?.user
        if (!user) return
        // prefer updating user metadata when available
        if (typeof sb.auth.updateUser === 'function') {
          await sb.auth.updateUser({ data: { display_name: next.displayName, player_names: next.playerNames } })
          return
        }
        // otherwise upsert into profiles table if available
        if (typeof sb.from === 'function') {
          const fromFn = sb.from as unknown as (table: string) => FromQuery
          await fromFn('profiles').upsert?.({ id: user.id, display_name: next.displayName, player_names: next.playerNames })
        }
      } catch (err) {
        void err
      }
    })()
  } catch {
    // ignore
  }
}

/** Save a deduplicated list of player names to the local profile and cloud. */
export function saveProfilePlayerNames(names: string[] | undefined): void {
  try {
    const cur = loadProfile()
    const trimmed = (names ?? []).map((n) => (n ?? '').trim()).filter(Boolean)
    const uniq: string[] = Array.from(new Set(trimmed))
    const next = { ...cur, playerNames: uniq }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    console.debug('saveProfilePlayerNames: saved local profile', next)
    try {
      const ev = new CustomEvent("profile:updated", { detail: { displayName: next.displayName, playerNames: next.playerNames } })
      window.dispatchEvent(ev)
    } catch (err) { void err }
    ;(async function persist() {
      try {
        if (!sb.auth || typeof sb.auth.getUser !== 'function') return
        const userResp = await sb.auth.getUser!()
        const user = userResp?.data?.user
        if (!user) return
        if (typeof sb.auth.updateUser === 'function') {
          await sb.auth.updateUser({ data: { player_names: uniq } })
          return
        }
        if (typeof sb.from === 'function') {
          const fromFn = sb.from as unknown as (table: string) => FromQuery
          await fromFn('profiles').upsert?.({ id: user.id, player_names: uniq })
          console.debug('saveProfilePlayerNames: supabase user', user?.id)
        }
      } catch (err) {
            const resp = await sb.auth.updateUser({ data: { player_names: uniq } })
            console.debug('saveProfilePlayerNames: updateUser response', resp)
      }
    })()
  } catch (err) { void err }
            const fromFn = sb.from as unknown as (table: string) => FromQuery
            const resp = await fromFn('profiles').upsert?.({ id: user.id, player_names: uniq })
            console.debug('saveProfilePlayerNames: profiles upsert response', resp)

/** Merge and add new player names into existing saved profile player list. */
export function addProfilePlayerNames(names: string[] | undefined): void {
  if (!names || names.length === 0) return
  try {
    const cur = loadProfile()
    const existing = (cur.playerNames ?? []).map((n) => n.trim()).filter(Boolean)
    const incoming = names.map((n) => (n ?? '').trim()).filter(Boolean)
    const merged = Array.from(new Set([...existing, ...incoming]))
    saveProfilePlayerNames(merged)
  } catch (err) { void err }
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Parse a JSON string (clean export or legacy format) into Game[] without
 * persisting anywhere. Used by both the localStorage import and the
 * Supabase-backed import.
 */
export function parseImportJson(json: string): { success: boolean; games: Game[]; pods?: Pod[]; error?: string } {
  try {
    const parsed = JSON.parse(json)

    let parsedPods: Pod[] | undefined = undefined
    if (parsed && parsed.pods && Array.isArray(parsed.pods)) {
      parsedPods = parsed.pods as Pod[]
    }

    // Accept the clean export format { exportedAt, games: ExportGame[] }
    // or a raw Game[] array (backwards compat with old exports)
    let rawGames: unknown[]
    if (Array.isArray(parsed)) {
      rawGames = parsed
    } else if (parsed.games && Array.isArray(parsed.games)) {
      rawGames = parsed.games
    } else {
      return { success: false, games: [], error: "Invalid format — expected a games array." }
    }

    const games: Game[] = rawGames.map((raw: unknown) => {
      const g = raw as Record<string, unknown>

      // Detect clean format (winnerIndex present) vs legacy format (winnerId present)
      if (typeof g.winnerIndex === "number" && Array.isArray(g.players)) {
        const playerData = g.players as ExportPlayer[]
        const players: Player[] = playerData.map((p, i) => ({
          ...p,
          id: generateId(),
          isMe: i === 0,
          knockoutTurn: typeof p.knockoutTurn === "number" ? p.knockoutTurn : undefined,
          seatPosition: p.seatPosition as Player["seatPosition"],
          commanderColorIdentity: p.commanderColorIdentity as Player["commanderColorIdentity"],
        }))
        return {
          id: generateId(),
          playedAt: typeof g.playedAt === "string" ? new Date(g.playedAt).toISOString() : new Date().toISOString(),
          winTurn: typeof g.winTurn === "number" ? g.winTurn : 0,
          winnerId: players[g.winnerIndex]?.id ?? players[0].id,
          podId: typeof g.podId === "string" ? g.podId : undefined,
          notes: typeof g.notes === "string" ? g.notes : undefined,
          winConditions: Array.isArray(g.winConditions) ? g.winConditions as string[] : undefined,
          keyWinconCards: Array.isArray(g.keyWinconCards) ? g.keyWinconCards as string[] : undefined,
          bracket: typeof g.bracket === "number" ? g.bracket : undefined,
          players,
        } as Game
      }

      // Legacy format: already a full Game object — regenerate IDs to ensure fresh start
      const legacyPlayers = (g.players as Player[]).map((p, i) => ({
        ...p,
        id: generateId(),
        isMe: i === 0,
      }))
      const oldToNew = new Map<string, string>()
      ;(g.players as Player[]).forEach((p, i) => oldToNew.set(p.id, legacyPlayers[i].id))
      const oldWinnerId = g.winnerId as string
      return {
        ...g,
        id: generateId(),
        players: legacyPlayers,
        winnerId: oldToNew.get(oldWinnerId) ?? legacyPlayers[0].id,
      } as Game
    })

    return { success: true, games, pods: parsedPods }
  } catch {
    return { success: false, games: [], error: "Invalid JSON." }
  }
}

/** Parse + save to localStorage (kept for backwards compat / tests). */
export function importData(json: string): { success: boolean; count: number; error?: string } {
  const result = parseImportJson(json)
  if (!result.success) return { success: false, count: 0, error: result.error }
  // If pods were included in the export, restore them
  if (result.pods && Array.isArray(result.pods)) {
    try {
      savePods(result.pods)
    } catch {
      // ignore save errors
    }
  }

  saveGames(result.games)
  return { success: true, count: result.games.length }
}
