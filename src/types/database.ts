import type { Player } from "@/types"

// ─── Supabase Database Types ────────────────────────────────────────────────

/** JSON shape stored in the `players` JSONB column */
export type DbPlayer = Omit<Player, "id" | "isMe"> & {
  id: string
  is_me: boolean
}

export interface GameRow {
  id: string
  user_id: string
  played_at: string
  win_turn: number
  winner_player_id: string
  notes: string | null
  win_conditions: string[] | null
  key_wincon_cards: string[] | null
  bracket: number | null
  players: DbPlayer[]
  created_at: string
  updated_at: string
}

export interface GameInsert {
  id?: string
  user_id?: string // set by RLS default
  played_at: string
  win_turn: number
  winner_player_id: string
  notes?: string | null
  win_conditions?: string[] | null
  key_wincon_cards?: string[] | null
  bracket?: number | null
  players: DbPlayer[]
}

export interface GameUpdate {
  played_at?: string
  win_turn?: number
  winner_player_id?: string
  notes?: string | null
  win_conditions?: string[] | null
  key_wincon_cards?: string[] | null
  bracket?: number | null
  players?: DbPlayer[]
  updated_at?: string
}

export interface Database {
  public: {
    Tables: {
      games: {
        Row: GameRow
        Insert: GameInsert
        Update: GameUpdate
      }
    }
  }
}
