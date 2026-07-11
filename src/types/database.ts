import type { DeckCard, DeckSource, MtgColor, Player } from "@/types"

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

export interface DeckRow {
  id: string
  user_id: string
  name: string
  commander_name: string
  partner_name: string | null
  color_identity: MtgColor[] | null
  source: DeckSource
  source_url: string | null
  cards: DeckCard[]
  fast_mana_cards: string[]
  created_at: string
  updated_at: string
}

export interface DeckInsert {
  id?: string
  user_id?: string // set by RLS default
  name: string
  commander_name: string
  partner_name?: string | null
  color_identity?: MtgColor[] | null
  source: DeckSource
  source_url?: string | null
  cards: DeckCard[]
  fast_mana_cards: string[]
}

export interface DeckUpdate {
  name?: string
  commander_name?: string
  partner_name?: string | null
  color_identity?: MtgColor[] | null
  source?: DeckSource
  source_url?: string | null
  cards?: DeckCard[]
  fast_mana_cards?: string[]
  updated_at?: string
}

export interface Database {
  public: {
    Tables: {
      games: {
        Row: GameRow
        Insert: GameInsert
        Update: GameUpdate
        Relationships: []
      }
      decks: {
        Row: DeckRow
        Insert: DeckInsert
        Update: DeckUpdate
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
