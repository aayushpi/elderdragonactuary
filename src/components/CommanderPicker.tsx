import { useEffect, useMemo, useRef, useState } from "react"
import { Clock, Search, Loader2, Check, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useScryfall } from "@/hooks/useScryfall"
import { extractCardData } from "@/lib/shared"
import { ManaCost } from "@/components/ManaCost"
import { Pips, SECTION_LABEL } from "@/components/modern/primitives"
import type { MtgColor } from "@/types"
import type { CommanderShortlistItem } from "@/lib/shortlist"

export type { CommanderShortlistItem } from "@/lib/shortlist"

export interface CommanderPick {
  commanderName: string
  commanderImageUri?: string
  commanderColorIdentity?: MtgColor[]
  commanderManaCost?: string
  commanderTypeLine?: string
}

interface CommanderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seatLabel?: string
  contextLabel?: string
  /** "You" or a pod-mate's display name; drives the recents heading. */
  label?: string
  value?: string
  items: CommanderShortlistItem[]
  onPick: (pick: CommanderPick) => void
}

const DAY = 24 * 60 * 60 * 1000

function formatRelative(iso?: string): string | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 14) return "last week"
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function shortlistSub(item: CommanderShortlistItem): string {
  const relative = formatRelative(item.lastPlayedISO)
  if (item.games >= 2) {
    const base = `${item.games} games · ${Math.round(item.winRate * 100)}%`
    const recent =
      item.lastPlayedISO && Date.now() - new Date(item.lastPlayedISO).getTime() < 10 * DAY
    return recent && relative ? `${base} · ${relative}` : base
  }
  return relative ? `Played ${relative}` : "Played once"
}

/** Fuzzy match: forgives partial words and out-of-order tokens. Lower = better;
 *  null when any token is missing. */
function matchScore(name: string, query: string): number | null {
  const n = name.toLowerCase()
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null
  let score = 0
  for (const token of tokens) {
    const idx = n.indexOf(token)
    if (idx < 0) return null
    score += idx
  }
  return score
}

export function CommanderPicker({
  open,
  onOpenChange,
  seatLabel,
  contextLabel,
  label = "You",
  value,
  items,
  onPick,
}: CommanderPickerProps) {
  const [mode, setMode] = useState<"recents" | "search">("recents")
  const [resolving, setResolving] = useState(false)
  const { query, setQuery, suggestions, isLoading, fetchCard } = useScryfall("commander")
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open; jump straight to search when there are no recents.
  useEffect(() => {
    if (open) {
      setMode(items.length > 0 ? "recents" : "search")
      setResolving(false)
      setQuery("")
    }
  }, [open, items.length, setQuery])

  // Focus the field when entering search — this is the one place the keyboard opens.
  useEffect(() => {
    if (open && mode === "search") {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open, mode])

  // Rank the player's commanders by games played for the "#N most played" badge.
  const rankByName = useMemo(() => {
    const ranked = [...items].sort((a, b) => b.games - a.games)
    const map = new Map<string, number>()
    ranked.forEach((it, i) => map.set(it.name, i + 1))
    return map
  }, [items])

  const trimmed = query.trim()

  const historyMatches = useMemo(() => {
    if (!trimmed) return []
    return items
      .map((it) => ({ it, score: matchScore(it.name, trimmed) }))
      .filter((m): m is { it: CommanderShortlistItem; score: number } => m.score !== null)
      .sort((a, b) => a.score - b.score || b.it.games - a.it.games)
      .map((m) => m.it)
  }, [items, trimmed])

  const searchMatches = useMemo(() => {
    const known = new Set(items.map((i) => i.name.toLowerCase()))
    return suggestions.filter((s) => !known.has(s.name.toLowerCase()))
  }, [suggestions, items])

  function pickItem(item: CommanderShortlistItem) {
    onPick({
      commanderName: item.name,
      commanderImageUri: item.imageUri,
      commanderColorIdentity: item.colorIdentity,
      commanderManaCost: item.manaCost,
      commanderTypeLine: item.typeLine,
    })
    onOpenChange(false)
  }

  async function pickSearchResult(name: string) {
    setResolving(true)
    const card = await fetchCard(name)
    setResolving(false)
    onPick({ commanderName: name, ...(card ? extractCardData(card) : {}) })
    onOpenChange(false)
  }

  // Escape hatch — save the raw text now, match it to a real card later.
  function saveAsWritten() {
    if (!trimmed) return
    onPick({ commanderName: trimmed })
    onOpenChange(false)
  }

  // Enter picks the top hit (history > search), else falls back to "as written".
  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (historyMatches[0]) pickItem(historyMatches[0])
    else if (searchMatches[0]) void pickSearchResult(searchMatches[0].name)
    else saveAsWritten()
  }

  const recentsHeading = label === "You" ? "Your recents" : `${label}'s recents`
  const subtitle =
    mode === "search"
      ? [seatLabel, "results stay above the keyboard"].filter(Boolean).join(" · ")
      : [seatLabel, contextLabel].filter(Boolean).join(" · ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md gap-0 p-0 overflow-hidden flex flex-col !top-3 !translate-y-0 max-h-[calc(100dvh-1.5rem)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {mode === "search" ? "Search commanders" : "Pick a commander"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{subtitle}</DialogDescription>
        </DialogHeader>

        {mode === "recents" ? (
          <>
            {/* Recents shortlist */}
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <span className={SECTION_LABEL}>{recentsHeading}</span>
              <span className="font-mono text-[11px] text-muted-foreground">one tap</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
              <div className="divide-y divide-border">
                {items.slice(0, 6).map((item) => (
                  <button
                    key={item.name}
                    onClick={() => pickItem(item)}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold">{item.name}</span>
                        {value === item.name && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground tabular">
                        {shortlistSub(item)}
                      </div>
                    </div>
                    {item.colorIdentity && item.colorIdentity.length > 0 && (
                      <Pips colors={item.colorIdentity} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Search affordance — tapping it switches to keyboard-aware search */}
            <div className="border-t border-border px-5 py-4">
              <button
                onClick={() => setMode("search")}
                className="flex h-12 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3.5 text-left text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <Search className="h-4 w-4" />
                Or search everything…
              </button>
              <p className="mt-3 text-xs text-muted-foreground">
                Keyboard never opens unless you reach for search — recents cover most repeat games.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Pinned search input */}
            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search a commander…"
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
                    {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base">×</span>}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-5 pb-2">
              <span className={SECTION_LABEL}>Best matches</span>
              <span className="font-mono text-[11px] text-muted-foreground">return picks the top hit</span>
            </div>

            {/* Results band — sits above the keyboard, never under it */}
            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border divide-y divide-border">
              {trimmed.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Start typing to search every commander.
                </p>
              ) : (
                <>
                  {historyMatches.map((item) => (
                    <button
                      key={`h-${item.name}`}
                      onClick={() => pickItem(item)}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold">{item.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground tabular">
                          #{rankByName.get(item.name)} most played
                        </div>
                      </div>
                      {item.colorIdentity && item.colorIdentity.length > 0 && (
                        <Pips colors={item.colorIdentity} />
                      )}
                    </button>
                  ))}

                  {searchMatches.map((s) => (
                    <button
                      key={`s-${s.name}`}
                      onClick={() => pickSearchResult(s.name)}
                      disabled={resolving}
                      className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                    >
                      <span className="truncate text-base">{s.name}</span>
                      {s.manaCost && <ManaCost cost={s.manaCost} size="xs" />}
                    </button>
                  ))}

                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching…
                    </div>
                  )}

                  {/* Escape hatch — never block logging */}
                  <button
                    onClick={saveAsWritten}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                  >
                    <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-base font-medium">Use “{trimmed}” as written</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Save now, match to a card later</div>
                    </div>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
