/**
 * Supabase-backed storage layer.
 *
 * Converts between the frontend `Game` type (camelCase, embedded players)
 * and the Supabase `games` table (snake_case, JSONB players column).
 */

import { supabase } from "@/lib/supabase"
import type { Game, Player } from "@/types"
import type { GameRow, DbPlayer } from "@/types/database"

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const maybe = error as { message?: string; details?: string; hint?: string }
  const text = `${maybe.message ?? ""} ${maybe.details ?? ""} ${maybe.hint ?? ""}`.toLowerCase()
  return text.includes("column") && text.includes("does not exist")
}

async function getCurrentUserId(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionResp = await (supabase as any).auth.getSession()
  const s = sessionResp?.data?.session ?? null
  const userId = s?.user?.id
  if (!userId) throw new Error("No authenticated user found.")
  return userId
}

// ─── Helpers: domain ↔ DB conversion ─────────────────────────────────────────

function playerToDb(p: Player): DbPlayer {
  return {
    id: p.id,
    is_me: p.isMe,
    commanderName: p.commanderName,
    commanderImageUri: p.commanderImageUri,
    commanderColorIdentity: p.commanderColorIdentity,
    commanderManaCost: p.commanderManaCost,
    commanderTypeLine: p.commanderTypeLine,
    partnerName: p.partnerName,
    partnerImageUri: p.partnerImageUri,
    partnerManaCost: p.partnerManaCost,
    partnerTypeLine: p.partnerTypeLine,
    knockoutTurn: p.knockoutTurn,
    seatPosition: p.seatPosition,
    displayName: p.displayName,
    fastMana: p.fastMana,
  }
}

function dbToPlayer(d: DbPlayer): Player {
  return {
    id: d.id,
    isMe: d.is_me,
    commanderName: d.commanderName,
    commanderImageUri: d.commanderImageUri,
    commanderColorIdentity: d.commanderColorIdentity,
    commanderManaCost: d.commanderManaCost,
    commanderTypeLine: d.commanderTypeLine,
    partnerName: d.partnerName,
    partnerImageUri: d.partnerImageUri,
    partnerManaCost: d.partnerManaCost,
    partnerTypeLine: d.partnerTypeLine,
    knockoutTurn: d.knockoutTurn,
    seatPosition: d.seatPosition,
    displayName: d.displayName,
    fastMana: d.fastMana,
  }
}

function rowToGame(row: GameRow): Game {
  const players = (row.players as unknown as DbPlayer[]).map(dbToPlayer)
  // Derive playerNames from per-player displayName stored in the JSONB
  let playerNames: Record<string, string> | undefined
  const allNamed = players.every((p) => p.displayName?.trim())
  if (allNamed && players.length > 0) {
    playerNames = {}
    for (const p of players) {
      playerNames[p.id] = p.displayName!.trim()
    }
  }
  return {
    id: row.id,
    playedAt: row.played_at,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    startingPlayerId: row.starting_player_id ?? undefined,
    players,
    winnerId: row.winner_player_id,
    winTurn: row.win_turn,
    notes: row.notes ?? undefined,
    winConditions: row.win_conditions ?? undefined,
    keyWinconCards: row.key_wincon_cards ?? undefined,
    bracket: row.bracket ?? undefined,
    liveSummary: row.live_summary ?? undefined,
    playerNames,
  }
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

export async function fetchGames(): Promise<Game[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("games")
    .select("*")
    .order("played_at", { ascending: false })

  if (error) throw error
  return (data as GameRow[]).map(rowToGame)
}

export async function insertGame(game: Game): Promise<Game> {
  const userId = await getCurrentUserId()

  const gamesTable = supabase.from("games") as unknown as {
    insert: (values: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } }
  }

  const payloadWithLive = {
    user_id: userId,
    played_at: game.playedAt,
    started_at: game.startedAt ?? null,
    ended_at: game.endedAt ?? null,
    duration_ms: game.durationMs ?? null,
    starting_player_id: game.startingPlayerId ?? null,
    win_turn: game.winTurn,
    winner_player_id: game.winnerId,
    notes: game.notes ?? null,
    win_conditions: game.winConditions ?? null,
    key_wincon_cards: game.keyWinconCards ?? null,
    bracket: game.bracket ?? null,
    live_summary: game.liveSummary ?? null,
    players: game.players.map(playerToDb) as unknown as GameRow["players"],
  }

  const payloadLegacy = {
    user_id: userId,
    played_at: game.playedAt,
    win_turn: game.winTurn,
    winner_player_id: game.winnerId,
    notes: game.notes ?? null,
    win_conditions: game.winConditions ?? null,
    key_wincon_cards: game.keyWinconCards ?? null,
    bracket: game.bracket ?? null,
    players: game.players.map(playerToDb) as unknown as GameRow["players"],
  }

  let result = await gamesTable.insert(payloadWithLive).select().single()
  if (result.error && isMissingColumnError(result.error)) {
    result = await gamesTable.insert(payloadLegacy).select().single()
  }

  if (result.error) throw result.error
  return rowToGame(result.data as GameRow)
}

export async function patchGame(id: string, patch: Partial<Game>): Promise<Game> {
  // Build the update object, only including fields that are present in the patch
  const update: Record<string, unknown> = {}
  const legacyUpdate: Record<string, unknown> = {}

  if (patch.playedAt !== undefined) {
    update.played_at = patch.playedAt
    legacyUpdate.played_at = patch.playedAt
  }
  if (patch.startedAt !== undefined) update.started_at = patch.startedAt ?? null
  if (patch.endedAt !== undefined) update.ended_at = patch.endedAt ?? null
  if (patch.durationMs !== undefined) update.duration_ms = patch.durationMs ?? null
  if (patch.startingPlayerId !== undefined) update.starting_player_id = patch.startingPlayerId ?? null
  if (patch.winTurn !== undefined) {
    update.win_turn = patch.winTurn
    legacyUpdate.win_turn = patch.winTurn
  }
  if (patch.winnerId !== undefined) {
    update.winner_player_id = patch.winnerId
    legacyUpdate.winner_player_id = patch.winnerId
  }
  if (patch.notes !== undefined) {
    update.notes = patch.notes ?? null
    legacyUpdate.notes = patch.notes ?? null
  }
  if (patch.winConditions !== undefined) {
    update.win_conditions = patch.winConditions ?? null
    legacyUpdate.win_conditions = patch.winConditions ?? null
  }
  if (patch.keyWinconCards !== undefined) {
    update.key_wincon_cards = patch.keyWinconCards ?? null
    legacyUpdate.key_wincon_cards = patch.keyWinconCards ?? null
  }
  if (patch.bracket !== undefined) {
    update.bracket = patch.bracket ?? null
    legacyUpdate.bracket = patch.bracket ?? null
  }
  if (patch.liveSummary !== undefined) update.live_summary = patch.liveSummary ?? null
  if (patch.players !== undefined) {
    update.players = patch.players.map(playerToDb)
    legacyUpdate.players = patch.players.map(playerToDb)
  }

  const gamesTable = supabase.from("games") as unknown as {
    update: (values: unknown) => { eq: (column: string, value: string) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } } }
  }

  let result = await gamesTable
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (result.error && isMissingColumnError(result.error)) {
    result = await gamesTable
      .update(legacyUpdate)
      .eq("id", id)
      .select()
      .single()
  }

  if (result.error) throw result.error
  return rowToGame(result.data as GameRow)
}

export async function removeGame(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("games").delete().eq("id", id)
  if (error) throw error
}

/** Bulk insert games (used for import). Deletes all existing games first. */
export async function replaceAllGames(games: Game[]): Promise<Game[]> {
  const userId = await getCurrentUserId()

  // Delete all existing games for this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase as any).from("games").delete().eq("user_id", userId)
  if (delErr) throw delErr

  if (games.length === 0) return []

  // If multiple games share the exact same `playedAt` timestamp (common when
  // importing date-only exports), Postgres ordering by `played_at` alone can
  // return them in arbitrary order. To preserve the original array order from
  // the import, add tiny millisecond offsets for duplicate timestamps so
  // ordering by `played_at` (descending) yields the same sequence as the
  // imported array.
  const playedAtGroups = new Map<string, number[]>()
  games.forEach((g, idx) => {
    const key = g.playedAt
    const arr = playedAtGroups.get(key) ?? []
    arr.push(idx)
    playedAtGroups.set(key, arr)
  })

  const adjustedPlayedAts: string[] = new Array(games.length)
  for (const [key, indices] of playedAtGroups.entries()) {
    if (indices.length === 1) {
      adjustedPlayedAts[indices[0]] = key
      continue
    }
    // multiple entries with identical timestamp: assign millisecond offsets
    // so that the earlier item in the array gets a slightly later timestamp
    // (so it sorts earlier when ordering descending by played_at).
    const base = new Date(key).getTime()
    const len = indices.length
    indices.forEach((origIdx, i) => {
      const offset = len - i // 1..len
      adjustedPlayedAts[origIdx] = new Date(base + offset).toISOString()
    })
  }

  const rowsWithLive = games.map((game, idx) => ({
    user_id: userId,
    played_at: adjustedPlayedAts[idx] ?? game.playedAt,
    started_at: game.startedAt ?? null,
    ended_at: game.endedAt ?? null,
    duration_ms: game.durationMs ?? null,
    starting_player_id: game.startingPlayerId ?? null,
    win_turn: game.winTurn,
    winner_player_id: game.winnerId,
    notes: game.notes ?? null,
    win_conditions: game.winConditions ?? null,
    key_wincon_cards: game.keyWinconCards ?? null,
    bracket: game.bracket ?? null,
    live_summary: game.liveSummary ?? null,
    players: game.players.map(playerToDb) as unknown as GameRow["players"],
  }))

  const rowsLegacy = games.map((game, idx) => ({
    user_id: userId,
    played_at: adjustedPlayedAts[idx] ?? game.playedAt,
    win_turn: game.winTurn,
    winner_player_id: game.winnerId,
    notes: game.notes ?? null,
    win_conditions: game.winConditions ?? null,
    key_wincon_cards: game.keyWinconCards ?? null,
    bracket: game.bracket ?? null,
    players: game.players.map(playerToDb) as unknown as GameRow["players"],
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gamesTable = (supabase as any).from("games") as unknown as {
    insert: (values: unknown) => { select: () => Promise<{ data: unknown; error: unknown }> }
  }

  let result = await gamesTable.insert(rowsWithLive).select()
  if (result.error && isMissingColumnError(result.error)) {
    result = await gamesTable.insert(rowsLegacy).select()
  }
  if (result.error) throw result.error
  return (result.data as GameRow[]).map(rowToGame)
}
