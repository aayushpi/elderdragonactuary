import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import type { Game } from "@/types"
import { useAuth } from "@/hooks/useAuth"
import {
  fetchGames,
  insertGame,
  patchGame,
  removeGame,
  replaceAllGames,
} from "@/lib/supabaseStorage"
import { parseImportJson } from "@/lib/storage"

export function useGames() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch games after auth state is known and whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false

    if (authLoading) {
      setLoading(true)
      return () => {
        cancelled = true
      }
    }

    if (!userId) {
      setGames([])
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    fetchGames()
      .then((data) => {
        if (!cancelled) setGames(data)
      })
      .catch((err) => {
        console.error("Failed to fetch games:", err)
        toast.error("Failed to load games from the server.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, userId])

  const addGame = useCallback(async (game: Game) => {
    try {
      const saved = await insertGame(game)
      setGames((prev) => [saved, ...prev])
    } catch (err) {
      console.error("Failed to save game:", err)
      toast.error("Failed to save game.")
      throw err
    }
  }, [])

  const updateGame = useCallback(async (id: string, patch: Partial<Game>) => {
    try {
      const updated = await patchGame(id, patch)
      setGames((prev) => prev.map((g) => (g.id === id ? updated : g)))
    } catch (err) {
      console.error("Failed to update game:", err)
      toast.error("Failed to update game.")
      throw err
    }
  }, [])

  const deleteGame = useCallback(async (id: string) => {
    try {
      await removeGame(id)
      setGames((prev) => prev.filter((g) => g.id !== id))
    } catch (err) {
      console.error("Failed to delete game:", err)
      toast.error("Failed to delete game.")
      throw err
    }
  }, [])

  const getGame = useCallback(
    (id: string) => games.find((g) => g.id === id),
    [games]
  )

  const replaceGames = useCallback(async (json: string) => {
    // Parse JSON into Game[] without touching localStorage
    const result = parseImportJson(json)
    if (!result.success) return { success: false, count: 0, error: result.error }

    try {
      const cloudGames = await replaceAllGames(result.games)
      setGames(cloudGames)
      return { success: true, count: cloudGames.length }
    } catch (err) {
      console.error("Failed to import games:", err)
      toast.error("Failed to import games to the server.")
      return { success: false, count: 0, error: "Server error during import." }
    }
  }, [])

  const clearGames = useCallback(async () => {
    try {
      await replaceAllGames([])
      setGames([])
    } catch (err) {
      console.error("Failed to clear games:", err)
      toast.error("Failed to clear games from the server.")
    }
  }, [])

  return { games, loading, addGame, updateGame, deleteGame, getGame, replaceGames, clearGames }
}
