import { useEffect, useMemo, useState } from "react"
import { Clock, Search, Loader2, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useScryfall } from "@/hooks/useScryfall"
import { extractCardData } from "@/lib/shared"
import { Pips, SECTION_LABEL } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { MtgColor } from "@/types"

export interface CommanderShortlistItem {
  name: string
  games: number
  winRate: number // 0..1
  lastPlayedISO?: string
  colorIdentity?: MtgColor[]
  manaCost?: string
  imageUri?: string
  typeLine?: string
}

export interface CommanderPickerSource {
  id: string
  label: string // "You", "Aayush", …
  items: CommanderShortlistItem[]
}

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
  value?: string
  sources: CommanderPickerSource[]
  onPick: (sourceId: string, pick: CommanderPick) => void
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

export function CommanderPicker({
  open,
  onOpenChange,
  seatLabel,
  contextLabel,
  value,
  sources,
  onPick,
}: CommanderPickerProps) {
  const [activeId, setActiveId] = useState(sources[0]?.id ?? "")
  const [searching, setSearching] = useState(false)
  const [resolving, setResolving] = useState(false)
  const { query, setQuery, suggestions, isLoading, fetchCard } = useScryfall("commander")

  // Reset transient state whenever the picker is (re)opened.
  useEffect(() => {
    if (open) {
      setActiveId(sources[0]?.id ?? "")
      setSearching(false)
      setResolving(false)
      setQuery("")
    }
  }, [open, sources, setQuery])

  const active = useMemo(
    () => sources.find((s) => s.id === activeId) ?? sources[0],
    [sources, activeId]
  )

  function pickItem(item: CommanderShortlistItem) {
    onPick(active.id, {
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
    onPick(active.id, { commanderName: name, ...(card ? extractCardData(card) : {}) })
    onOpenChange(false)
  }

  const recentsHeading =
    active?.label === "You" ? "Your recents" : `${active?.label ?? ""}'s recents`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md gap-0 p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Pick a commander</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {[seatLabel, contextLabel].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        {/* Player tabs (rendered only when there is more than one source) */}
        {sources.length > 1 && (
          <div className="px-5 pb-4">
            <div className="grid grid-flow-col auto-cols-fr gap-2 rounded-lg border border-border p-1">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveId(s.id)
                    setSearching(false)
                    setQuery("")
                  }}
                  className={cn(
                    "h-11 rounded-md text-sm font-medium transition-colors",
                    s.id === active?.id
                      ? "bg-card text-foreground ring-2 ring-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recents shortlist */}
        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <span className={SECTION_LABEL}>{recentsHeading}</span>
          <span className="font-mono text-[11px] text-muted-foreground">one tap</span>
        </div>

        <div className="max-h-[40vh] overflow-y-auto border-t border-border">
          {active?.items.length ? (
            <div className="divide-y divide-border">
              {active.items.slice(0, 6).map((item) => (
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
          ) : (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              No recent commanders yet — search below.
            </div>
          )}
        </div>

        {/* Search fallback */}
        <div className="border-t border-border px-5 py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            {resolving ? (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : isLoading && query.length >= 2 ? (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearching(true)}
              placeholder="Or search everything…"
              className="h-12 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {query.length >= 2 && (
            <div className="max-h-[30vh] overflow-y-auto rounded-md border border-border divide-y divide-border">
              {!isLoading && suggestions.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No commanders found.
                </div>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => pickSearchResult(s.name)}
                    disabled={resolving}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                  >
                    <span className="truncate text-sm">{s.name}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {!searching && (
            <p className="text-xs text-muted-foreground">
              Keyboard never opens unless you reach for search — recents cover most repeat games.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
