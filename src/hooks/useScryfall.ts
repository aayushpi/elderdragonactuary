import { useState, useEffect, useRef, useCallback } from "react"
import type { ScryfallCard } from "@/types"
import type { CommanderSuggestion } from "@/lib/scryfall"
import {
  fetchCommanderSuggestions,
  fetchCompanionSuggestions,
  fetchPairingSuggestions,
  fetchCardSuggestions,
  fetchCardByName,
  fetchSuggestionsByQuery,
} from "@/lib/scryfall"

export type ScryfallSearchType = "commander" | "pairing" | "companion" | "card"

const SEARCHERS: Record<ScryfallSearchType, (q: string) => Promise<CommanderSuggestion[]>> = {
  commander: fetchCommanderSuggestions,
  pairing: fetchPairingSuggestions,
  companion: fetchCompanionSuggestions,
  card: fetchCardSuggestions,
}

export function useScryfall(searchType: ScryfallSearchType = "commander") {
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
        setSuggestions(await SEARCHERS[searchType](query))
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, searchType])

  const fetchCard = useCallback(async (name: string): Promise<ScryfallCard | null> => {
    try {
      return await fetchCardByName(name)
    } catch {
      return null
    }
  }, [])

  return { query, setQuery, suggestions, isLoading, fetchCard }
}

/** One-shot Scryfall query (e.g. legal partners for a commander). Empty while
 *  `query` is null. */
export function useScryfallQuery(query: string | null) {
  const [results, setResults] = useState<CommanderSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetchSuggestionsByQuery(query)
      .then((r) => { if (!cancelled) setResults(r) })
      .catch(() => { if (!cancelled) setResults([]) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [query])

  return { results, isLoading }
}

/** Resolves a card by name (cached) — null while loading, unknown, or blank. */
export function useCard(name: string | undefined) {
  const [card, setCard] = useState<ScryfallCard | null>(null)
  useEffect(() => {
    const trimmed = name?.trim()
    setCard(null)
    if (!trimmed) return
    let cancelled = false
    fetchCardByName(trimmed)
      .then((c) => { if (!cancelled) setCard(c) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [name])
  return card
}
