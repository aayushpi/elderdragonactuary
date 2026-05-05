import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export interface AdminPlayer {
  user_id: string
  email: string
  games_logged: number
  first_game_at: string | null
  last_game_at: string | null
  commanders_played: string[] | null
}

export interface AdminGame {
  id: string
  user_email: string
  played_at: string
  win_turn: number
  winner_player_id: string
  bracket: number | null
  win_conditions: string[] | null
  key_wincon_cards: string[] | null
  notes: string | null
  players: Array<{
    id: string
    is_me: boolean
    commanderName: string
    commanderImageUri?: string
    displayName?: string
    seatPosition: number
    knockoutTurn?: number
  }>
}

interface AdminDataState {
  players: AdminPlayer[]
  games: AdminGame[]
  loading: boolean
  unauthorized: boolean
  error: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (supabase as any).rpc?.bind(supabase) as
  ((fn: string) => Promise<{ data: unknown; error: { message: string } | null }>) | undefined

export function useAdminData(): AdminDataState {
  const [state, setState] = useState<AdminDataState>({
    players: [],
    games: [],
    loading: true,
    unauthorized: false,
    error: null,
  })

  useEffect(() => {
    if (!rpc) {
      setState((s) => ({ ...s, loading: false, error: "Supabase not configured" }))
      return
    }

    void (async () => {
      const [playersRes, gamesRes] = await Promise.all([
        rpc("admin_get_player_list"),
        rpc("admin_get_all_games"),
      ])

      if (playersRes.error?.message?.includes("Unauthorized") ||
          gamesRes.error?.message?.includes("Unauthorized")) {
        setState((s) => ({ ...s, loading: false, unauthorized: true }))
        return
      }

      if (playersRes.error) {
        setState((s) => ({ ...s, loading: false, error: playersRes.error!.message }))
        return
      }
      if (gamesRes.error) {
        setState((s) => ({ ...s, loading: false, error: gamesRes.error!.message }))
        return
      }

      setState({
        players: (playersRes.data as AdminPlayer[]) ?? [],
        games: (gamesRes.data as AdminGame[]) ?? [],
        loading: false,
        unauthorized: false,
        error: null,
      })
    })()
  }, [])

  return state
}
