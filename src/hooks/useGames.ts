import { useState, useCallback } from "react"
import type { Game } from "@/types"
import { loadGames, saveGames, importData } from "@/lib/storage"

export function useGames() {
  const [games, setGames] = useState<Game[]>(() => loadGames())

  const addGame = useCallback((game: Game) => {
    setGames((prev) => {
      const next = [game, ...prev]
      saveGames(next)
      return next
    })
  }, [])

  const updateGame = useCallback((id: string, patch: Partial<Game>) => {
    setGames((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
      saveGames(next)
      return next
    })
  }, [])

  const deleteGame = useCallback((id: string) => {
    setGames((prev) => {
      const next = prev.filter((g) => g.id !== id)
      saveGames(next)
      return next
    })
  }, [])

  const getGame = useCallback(
    (id: string) => games.find((g) => g.id === id),
    [games]
  )

  const replaceGames = useCallback((json: string) => {
    const result = importData(json)
    if (result.success) setGames(loadGames())
    return result
  }, [])

  const clearGames = useCallback(() => {
    setGames([])
    saveGames([])
  }, [])

  return { games, addGame, updateGame, deleteGame, getGame, replaceGames, clearGames }
}
