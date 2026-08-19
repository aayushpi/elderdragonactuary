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

/** One row of public.admin_account_usage(). */
export interface AdminAccountUsageRow {
  user_id: string
  email: string | null
  signed_up_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  games_logged: number
  first_game_at: string | null
  last_game_at: string | null
  last_logged_at: string | null
  active_days: number
  games_last_7d: number
  games_last_30d: number
  avg_pod_size: number | null
  avg_win_turn: number | null
  wins: number
}

/** The single row returned by public.admin_usage_totals(). */
export interface AdminUsageTotalsRow {
  total_accounts: number
  accounts_with_games: number
  active_7d: number
  active_30d: number
  new_accounts_30d: number
  total_games: number
  games_7d: number
  games_30d: number
  median_games_per_account: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      admin_account_usage: {
        Args: Record<string, never>
        Returns: AdminAccountUsageRow[]
      }
      admin_usage_totals: {
        Args: Record<string, never>
        Returns: AdminUsageTotalsRow[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
