import { useEffect, useMemo, useRef } from "react"
import { Search, Check, Plus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useScryfall } from "@/hooks/useScryfall"
import { useKeyboardInset } from "@/hooks/useKeyboardInset"
import { formatRelative, matchScore, type WinconShortlistItem } from "@/lib/shortlist"
import { ManaCost } from "@/components/ManaCost"
import { SECTION_LABEL, SHEET_CONTENT_CLASS } from "@/components/modern/primitives"

interface WinconCardPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Wincon cards from game history, already ordered most-used first. */
  items: WinconShortlistItem[]
  selectedCards: string[]
  onAdd: (card: string) => void
  onRemove: (card: string) => void
}

function historySub(item: WinconShortlistItem): string {
  const relative = formatRelative(item.lastPlayedISO)
  if (item.games >= 2) {
    return `${item.games} games${relative ? ` · ${relative}` : ""}`
  }
  return relative ? `Logged ${relative}` : "Logged once"
}

export function WinconCardPicker({
  open,
  onOpenChange,
  items,
  selectedCards,
  onAdd,
  onRemove,
}: WinconCardPickerProps) {
  const { query, setQuery, suggestions, isLoading } = useScryfall("card")
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboardInset = useKeyboardInset()

  useEffect(() => {
    if (open) setQuery("")
  }, [open, setQuery])

  // Nothing to tap without history — jump straight to typing.
  useEffect(() => {
    if (open && items.length === 0) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open, items.length])

  const selectedSet = useMemo(
    () => new Set(selectedCards.map((c) => c.toLowerCase())),
    [selectedCards]
  )

  function toggle(card: string) {
    if (selectedSet.has(card.toLowerCase())) onRemove(card)
    else onAdd(card)
  }

  const trimmed = query.trim()

  // History plus any already-picked card that isn't in it, so everything
  // currently selected can be untoggled from the same list.
  const historyRows = useMemo(() => {
    const known = new Set(items.map((i) => i.name.toLowerCase()))
    const extras = selectedCards
      .filter((c) => !known.has(c.toLowerCase()))
      .map((name): WinconShortlistItem => ({ name, games: 0 }))
    return [...items, ...extras]
  }, [items, selectedCards])

  // Typing in the bottom search filters history and searches Scryfall at once.
  const historyMatches = useMemo(() => {
    if (!trimmed) return historyRows
    return historyRows
      .map((it) => ({ it, score: matchScore(it.name, trimmed) }))
      .filter((m): m is { it: WinconShortlistItem; score: number } => m.score !== null)
      .sort((a, b) => a.score - b.score || b.it.games - a.it.games)
      .map((m) => m.it)
  }, [historyRows, trimmed])

  const searchMatches = useMemo(() => {
    const known = new Set(historyRows.map((i) => i.name.toLowerCase()))
    return suggestions.filter((s) => !known.has(s.name.toLowerCase()))
  }, [suggestions, historyRows])

  const exactMatch =
    historyMatches.some((i) => i.name.toLowerCase() === trimmed.toLowerCase()) ||
    suggestions.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())

  function addAndClear(card: string) {
    if (!selectedSet.has(card.toLowerCase())) onAdd(card)
    setQuery("")
    inputRef.current?.focus()
  }

  // Enter picks the top hit (history > search), else adds the raw text.
  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || !trimmed) return
    e.preventDefault()
    if (historyMatches[0]) addAndClear(historyMatches[0].name)
    else if (searchMatches[0]) addAndClear(searchMatches[0].name)
    else addAndClear(trimmed)
  }

  function Row({ name, sub, manaCost }: { name: string; sub?: string; manaCost?: string }) {
    const active = selectedSet.has(name.toLowerCase())
    return (
      <button
        onClick={() => toggle(name)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
      >
        <span
          className={
            "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors " +
            (active ? "border-primary bg-primary text-primary-foreground" : "border-input text-transparent")
          }
        >
          <Check className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">{name}</span>
          {sub && <span className="mt-0.5 block text-xs text-muted-foreground tabular">{sub}</span>}
        </span>
        {manaCost && <ManaCost cost={manaCost} size="xs" />}
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Key wincon cards</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {selectedCards.length > 0
              ? `${selectedCards.length} selected · tap again to remove`
              : "tap to add, tap again to remove"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <span className={SECTION_LABEL}>{trimmed ? "Matches" : "Previously logged"}</span>
          {!trimmed && historyRows.length > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">most used first</span>
          )}
        </div>

        {/* Inset padding keeps the last rows reachable when the keyboard
            overlays the sheet (iOS) instead of shrinking it. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto border-t border-border divide-y divide-border"
          style={{ paddingBottom: keyboardInset }}
        >
          {historyMatches.map((item) => (
            <Row key={item.name} name={item.name} sub={item.games > 0 ? historySub(item) : undefined} />
          ))}

          {trimmed &&
            searchMatches.map((s) => <Row key={s.name} name={s.name} manaCost={s.manaCost} />)}

          {trimmed && isLoading && (
            <div className="flex items-center justify-center gap-2 px-5 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          )}

          {/* Escape hatch — never block logging */}
          {trimmed && !isLoading && !exactMatch && (
            <button
              onClick={() => addAndClear(trimmed)}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
            >
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-base font-medium">Add “{trimmed}”</span>
            </button>
          )}

          {!trimmed && historyRows.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              No wincon cards logged yet. Search below to add one.
            </p>
          )}
        </div>

        {/* Pinned search bar + Done — rides up with the keyboard on iOS,
            where the overlay would otherwise cover it */}
        <div
          className="border-t border-border bg-background px-5 py-4 transition-transform"
          style={{ transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined }}
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search any card…"
                className="h-12 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <span className="text-base">×</span>
                </button>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-12 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
