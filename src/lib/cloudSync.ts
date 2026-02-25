import type { User } from "@supabase/supabase-js"
import type { Game } from "@/types"
import { getSupabase } from "@/lib/supabase"

export const LAST_CLOUD_SYNC_KEY = "commando_last_cloud_sync_at"
export const CLOUD_SYNC_UPDATED_EVENT = "commando:cloud-sync-updated"

export function getLastCloudSyncAt() {
  try {
    return localStorage.getItem(LAST_CLOUD_SYNC_KEY)
  } catch {
    return null
  }
}

export function setLastCloudSyncAt(value: string | null) {
  try {
    if (!value) {
      localStorage.removeItem(LAST_CLOUD_SYNC_KEY)
    } else {
      localStorage.setItem(LAST_CLOUD_SYNC_KEY, value)
    }
  } catch {
    // ignore storage write failures
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLOUD_SYNC_UPDATED_EVENT, { detail: { value } }))
  }
}

export async function sendMagicLink(email: string) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error("Cloud sync is not configured.")
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) throw new Error(error.message)
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  return data.user
}

export async function signOutCloud() {
  const supabase = getSupabase()
  if (!supabase) return

  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function pushGamesToCloud(games: Game[]) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error("Cloud sync is not configured.")
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw new Error(userError.message)
  if (!userData.user) throw new Error("Please sign in first.")

  const now = new Date().toISOString()
  const { error } = await supabase.from("game_snapshots").upsert(
    {
      user_id: userData.user.id,
      games_json: games,
      updated_at: now,
    },
    { onConflict: "user_id" }
  )

  if (error) throw new Error(error.message)
  setLastCloudSyncAt(now)
  return now
}

export async function autoPushGamesToCloud(games: Game[]) {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw new Error(userError.message)
  if (!userData.user) return null

  const now = new Date().toISOString()
  const { error } = await supabase.from("game_snapshots").upsert(
    {
      user_id: userData.user.id,
      games_json: games,
      updated_at: now,
    },
    { onConflict: "user_id" }
  )

  if (error) throw new Error(error.message)
  setLastCloudSyncAt(now)
  return now
}

export async function pullGamesFromCloud(): Promise<{ games: Game[]; updatedAt: string | null }> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error("Cloud sync is not configured.")
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw new Error(userError.message)
  if (!userData.user) throw new Error("Please sign in first.")

  const { data, error } = await supabase
    .from("game_snapshots")
    .select("games_json, updated_at")
    .eq("user_id", userData.user.id)
    .maybeSingle<{ games_json: Game[]; updated_at: string | null }>()

  if (error) throw new Error(error.message)
  if (!data) return { games: [], updatedAt: null }

  setLastCloudSyncAt(data.updated_at ?? new Date().toISOString())

  return {
    games: Array.isArray(data.games_json) ? data.games_json : [],
    updatedAt: data.updated_at,
  }
}
