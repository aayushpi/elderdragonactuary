import { useEffect, useMemo, useRef, useState } from "react"
import { copy } from "@/copy"
import { Search, Sparkles, Check, Plus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useScryfall } from "@/hooks/useScryfall"
import { POPULAR_FAST_MANA } from "@/lib/fastMana"
import { SECTION_LABEL, SHEET_CONTENT_CLASS } from "@/components/modern/primitives"

interface FastManaPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seatLabel?: string
  selectedCards: string[]
  onAdd: (card: string) => void
  onRemove: (card: string) => void
}

export function FastManaPicker({
  open,
  onOpenChange,
  seatLabel,
  selectedCards,
  onAdd,
  onRemove,
}: FastManaPickerProps) {
  const [mode, setMode] = useState<"popular" | "search">("popular")
  const { query, setQuery, suggestions, isLoading } = useScryfall("card")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setMode("popular")
      setQuery("")
    }
  }, [open, setQuery])

  useEffect(() => {
    if (open && mode === "search") {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open, mode])

  const selectedSet = useMemo(
    () => new Set(selectedCards.map((c) => c.toLowerCase())),
    [selectedCards]
  )

  function toggle(card: string) {
    if (selectedSet.has(card.toLowerCase())) onRemove(card)
    else onAdd(card)
  }

  // Popular staples plus any already-picked card that isn't a staple, so the
  // popular view can untoggle everything currently selected.
  const popularRows = useMemo(() => {
    const popularLower = new Set(POPULAR_FAST_MANA.map((c) => c.toLowerCase()))
    const extras = selectedCards.filter((c) => !popularLower.has(c.toLowerCase()))
    return [...POPULAR_FAST_MANA, ...extras]
  }, [selectedCards])

  const trimmed = query.trim()

  const searchMatches = useMemo(() => {
    const popularLower = new Set(POPULAR_FAST_MANA.map((c) => c.toLowerCase()))
    return suggestions.filter((s) => !popularLower.has(s.name.toLowerCase()))
  }, [suggestions])

  const exactSuggested = suggestions.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())

  function Row({ name }: { name: string }) {
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
        <span className="truncate text-base font-medium flex-1">{name}</span>
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {mode === "search" ? copy.pickers.fastManaSearchTitle : copy.pickers.fastManaTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {[
              seatLabel,
              selectedCards.length > 0 ? `${selectedCards.length} selected` : "tap to add, tap again to remove",
            ]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        {mode === "popular" ? (
          <>
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <span className={SECTION_LABEL}>Popular fast mana</span>
              <span className="font-mono text-[11px] text-muted-foreground">one tap each</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border divide-y divide-border">
              {popularRows.map((name) => (
                <Row key={name} name={name} />
              ))}
            </div>

            <div className="border-t border-border px-5 py-4">
              <button
                onClick={() => setMode("search")}
                className="flex h-12 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3.5 text-left text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <Search className="h-4 w-4" />
                Or search every card…
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={copy.pickers.fastManaSearchPlaceholder}
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
                    <span className="text-base">×</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border divide-y divide-border">
              {trimmed.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Start typing to search every card.
                </p>
              ) : (
                <>
                  {searchMatches.map((s) => (
                    <Row key={s.name} name={s.name} />
                  ))}

                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching…
                    </div>
                  )}

                  {!isLoading && !exactSuggested && !selectedSet.has(trimmed.toLowerCase()) && (
                    <button
                      onClick={() => onAdd(trimmed)}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-base font-medium">Add “{trimmed}”</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <div className="border-t border-border px-5 py-3">
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
