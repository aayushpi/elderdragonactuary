/**
 * Supabase-backed storage layer.
 *
 * Converts between the frontend `Game` type (camelCase, embedded players)
 * and the Supabase `games` table (snake_case, JSONB players column).
 */

import { supabase } from "@/lib/supabase"
import type { Game, Player } from "@/types"
import type { GameRow, DbPlayer } from "@/types/database"

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = data.user?.id
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
    fastMana: d.fastMana,
  }
}

function rowToGame(row: GameRow): Game {
  const players = (row.players as unknown as DbPlayer[]).map(dbToPlayer)
  return {
    id: row.id,
    playedAt: row.played_at,
    players,
    winnerId: row.winner_player_id,
    winTurn: row.win_turn,
    notes: row.notes ?? undefined,
    winConditions: row.win_conditions ?? undefined,
    keyWinconCards: row.key_wincon_cards ?? undefined,
    bracket: row.bracket ?? undefined,
  }
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
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

  const { data, error } = await gamesTable
    .insert({
      user_id: userId,
      played_at: game.playedAt,
      win_turn: game.winTurn,
      winner_player_id: game.winnerId,
      notes: game.notes ?? null,
      win_conditions: game.winConditions ?? null,
      key_wincon_cards: game.keyWinconCards ?? null,
      bracket: game.bracket ?? null,
      players: game.players.map(playerToDb) as unknown as GameRow["players"],
    })
    .select()
    .single()

  if (error) throw error
  return rowToGame(data as GameRow)
}

export async function patchGame(id: string, patch: Partial<Game>): Promise<Game> {
  // Build the update object, only including fields that are present in the patch
  const update: Record<string, unknown> = {}

  if (patch.playedAt !== undefined) update.played_at = patch.playedAt
  if (patch.winTurn !== undefined) update.win_turn = patch.winTurn
  if (patch.winnerId !== undefined) update.winner_player_id = patch.winnerId
  if (patch.notes !== undefined) update.notes = patch.notes ?? null
  if (patch.winConditions !== undefined) update.win_conditions = patch.winConditions ?? null
  if (patch.keyWinconCards !== undefined) update.key_wincon_cards = patch.keyWinconCards ?? null
  if (patch.bracket !== undefined) update.bracket = patch.bracket ?? null
  if (patch.players !== undefined) update.players = patch.players.map(playerToDb)

  const gamesTable = supabase.from("games") as unknown as {
    update: (values: unknown) => { eq: (column: string, value: string) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } } }
  }

  const { data, error } = await gamesTable
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return rowToGame(data as GameRow)
}

export async function removeGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id)
  if (error) throw error
}

/** Bulk insert games (used for import). Deletes all existing games first. */
export async function replaceAllGames(games: Game[]): Promise<Game[]> {
  const userId = await getCurrentUserId()

  // Delete all existing games for this user
  const { error: delErr } = await supabase.from("games").delete().eq("user_id", userId)
  if (delErr) throw delErr

  if (games.length === 0) return []

  const rows = games.map((game) => ({
    user_id: userId,
    played_at: game.playedAt,
    win_turn: game.winTurn,
    winner_player_id: game.winnerId,
    notes: game.notes ?? null,
    win_conditions: game.winConditions ?? null,
    key_wincon_cards: game.keyWinconCards ?? null,
    bracket: game.bracket ?? null,
    players: game.players.map(playerToDb) as unknown as GameRow["players"],
  }))

  const gamesTable = supabase.from("games") as unknown as {
    insert: (values: unknown) => { select: () => Promise<{ data: unknown; error: unknown }> }
  }

  const { data, error } = await gamesTable.insert(rows).select()
  if (error) throw error
  return (data as GameRow[]).map(rowToGame)
}
