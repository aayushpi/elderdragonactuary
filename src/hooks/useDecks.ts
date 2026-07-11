import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import type { Deck } from "@/types"
import { useAuth } from "@/hooks/useAuth"
import { fetchDecks, insertDeck, updateDeck, removeDeck } from "@/lib/deckStorage"

export function useDecks() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (authLoading) {
      setLoading(true)
      return () => {
        cancelled = true
      }
    }

    if (!userId) {
      setDecks([])
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    fetchDecks()
      .then((data) => {
        if (!cancelled) setDecks(data)
      })
      .catch((err) => {
        console.error("Failed to fetch decks:", err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, userId])

  const addDeck = useCallback(async (deck: Deck) => {
    try {
      const saved = await insertDeck(deck)
      setDecks((prev) => [saved, ...prev])
      return saved
    } catch (err) {
      console.error("Failed to save deck:", err)
      toast.error("Failed to save deck.")
      throw err
    }
  }, [])

  const editDeck = useCallback(async (id: string, patch: Partial<Deck>) => {
    try {
      const updated = await updateDeck(id, patch)
      setDecks((prev) => prev.map((d) => (d.id === id ? updated : d)))
      return updated
    } catch (err) {
      console.error("Failed to update deck:", err)
      toast.error("Failed to update deck.")
      throw err
    }
  }, [])

  const deleteDeck = useCallback(async (id: string) => {
    try {
      await removeDeck(id)
      setDecks((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      console.error("Failed to delete deck:", err)
      toast.error("Failed to delete deck.")
      throw err
    }
  }, [])

  return { decks, loading, addDeck, editDeck, deleteDeck }
}
