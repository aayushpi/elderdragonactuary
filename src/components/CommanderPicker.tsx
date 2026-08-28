import { useEffect, useMemo, useRef, useState } from "react"
import { copy } from "@/copy"
import { Search, Loader2, Check, Pencil } from "lucide-react"
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
import { Pips, SECTION_LABEL, SHEET_CONTENT_CLASS } from "@/components/modern/primitives"
import type { MtgColor } from "@/types"
import { formatRelative, matchScore, type CommanderShortlistItem } from "@/lib/shortlist"
import { useKeyboardInset } from "@/hooks/useKeyboardInset"

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
  /** Recents-mode dialog title; defaults to "Pick a commander". */
  title?: string
  value?: string
  items: CommanderShortlistItem[]
  onPick: (pick: CommanderPick) => void
}

const DAY = 24 * 60 * 60 * 1000

function shortlistSub(item: CommanderShortlistItem): string {
  const relative = formatRelative(item.lastPlayedISO)
  if (item.games >= 2) {
    const base = `${item.games} games · ${Math.round(item.winRate * 100)}%`
    const recent =
      item.lastPlayedISO && Date.now() - new Date(item.lastPlayedISO).getTime() < 10 * DAY
    return recent && relative ? `${base} · ${relative}` : base
  }
  return relative ? copy.pickers.playedRelative(relative) : copy.pickers.playedOnce
}

/** Small rounded thumbnail of the commander's art, with an initial fallback. */
function CommanderThumb({ imageUri, name }: { imageUri?: string; name: string }) {
  if (imageUri) {
    return (
      <img
        src={imageUri}
        alt=""
        className="h-9 w-9 shrink-0 rounded-md object-cover border border-border"
      />
    )
  }
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-muted text-sm font-semibold text-muted-foreground">
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function CommanderPicker({
  open,
  onOpenChange,
  seatLabel,
  contextLabel,
  label = "You",
  title = copy.pickers.commanderTitle,
  value,
  items,
  onPick,
}: CommanderPickerProps) {
  const [mode, setMode] = useState<"recents" | "search">("recents")
  const [resolving, setResolving] = useState(false)
  const { query, setQuery, suggestions, isLoading, fetchCard } = useScryfall("commander")
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboardInset = useKeyboardInset()

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

  // Every commander this player has played, most-played first (ties broken by
  // recency). This is the full scrollable list and the source of the rank badge.
  const playedSorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          b.games - a.games ||
          new Date(b.lastPlayedISO ?? 0).getTime() - new Date(a.lastPlayedISO ?? 0).getTime() ||
          a.name.localeCompare(b.name)
      ),
    [items]
  )

  const rankByName = useMemo(() => {
    const map = new Map<string, number>()
    playedSorted.forEach((it, i) => map.set(it.name, i + 1))
    return map
  }, [playedSorted])

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

  const recentsHeading = label === copy.player.you ? copy.pickers.yourCommanders : copy.pickers.theirCommanders(label)
  const subtitle =
    mode === "search"
      ? [seatLabel, "results stay above the keyboard"].filter(Boolean).join(" · ")
      : [seatLabel, contextLabel].filter(Boolean).join(" · ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={SHEET_CONTENT_CLASS}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {mode === "search" ? copy.pickers.commanderSearchTitle : title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{subtitle}</DialogDescription>
        </DialogHeader>

        {mode === "recents" ? (
          <>
            {/* Full played list — most played first, scrollable */}
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <span className={SECTION_LABEL}>{recentsHeading}</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
              <div className="divide-y divide-border">
                {playedSorted.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => pickItem(item)}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                  >
                    <CommanderThumb imageUri={item.imageUri} name={item.name} />
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
                  placeholder={copy.pickers.commanderSearchPlaceholder}
                  className="h-12 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery("")
                      inputRef.current?.focus()
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground"
                    aria-label={copy.pickers.clearSearch}
                  >
                    {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base">×</span>}
                  </button>
                )}
              </div>
            </div>


            {/* Results band — sits above the keyboard, never under it. The
                inset padding keeps the last rows scrollable on iOS, where the
                keyboard overlays the sheet instead of shrinking it. */}
            <div
              className="flex-1 min-h-0 overflow-y-auto border-t border-border divide-y divide-border"
              style={{ paddingBottom: keyboardInset }}
            >
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
                      <CommanderThumb imageUri={item.imageUri} name={item.name} />
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
