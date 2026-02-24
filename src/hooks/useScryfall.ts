import { useState, useEffect, useRef, useCallback } from "react"
import type { ScryfallCard } from "@/types"
import type { CommanderSuggestion } from "@/lib/scryfall"
import { fetchCommanderSuggestions, fetchCardByName } from "@/lib/scryfall"

export function useScryfall() {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<CommanderSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const results = await fetchCommanderSuggestions(query)
        setSuggestions(results)
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const fetchCard = useCallback(async (name: string): Promise<ScryfallCard | null> => {
    try {
      return await fetchCardByName(name)
    } catch {
      return null
    }
  }, [])

  return { query, setQuery, suggestions, isLoading, fetchCard }
}
