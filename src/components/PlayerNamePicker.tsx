import { useEffect, useMemo, useRef, useState } from "react"
import { Search, User, Check, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { SECTION_LABEL, SHEET_CONTENT_CLASS } from "@/components/modern/primitives"

interface PlayerNamePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Saved player names, most-recent or alphabetical order decided by the caller. */
  names: string[]
  value?: string
  seatLabel?: string
  onPick: (name: string) => void
}

export function PlayerNamePicker({
  open,
  onOpenChange,
  names,
  value,
  seatLabel,
  onPick,
}: PlayerNamePickerProps) {
  const [mode, setMode] = useState<"recents" | "search">("recents")
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open; jump straight to typing when there are no saved names.
  useEffect(() => {
    if (open) {
      setMode(names.length > 0 ? "recents" : "search")
      setQuery("")
    }
  }, [open, names.length])

  // Focus the field when entering search — the one place the keyboard opens.
  useEffect(() => {
    if (open && mode === "search") {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open, mode])

  const trimmed = query.trim()

  const matches = useMemo(() => {
    if (!trimmed) return names
    const q = trimmed.toLowerCase()
    return names.filter((n) => n.toLowerCase().includes(q))
  }, [names, trimmed])

  function pick(name: string) {
    onPick(name)
    onOpenChange(false)
  }

  const exactMatch = names.some((n) => n.toLowerCase() === trimmed.toLowerCase())

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (matches[0]) pick(matches[0])
    else if (trimmed) pick(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {mode === "search" ? "Enter a name" : "Pick a player"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {[seatLabel, mode === "search" ? "results stay above the keyboard" : "tap a saved name or type a new one"]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        {mode === "recents" ? (
          <>
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <span className={SECTION_LABEL}>Saved players</span>
              <span className="font-mono text-[11px] text-muted-foreground">no typing needed</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
              <div className="divide-y divide-border">
                {names.map((name) => (
                  <button
                    key={name}
                    onClick={() => pick(name)}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-base font-semibold flex-1">{name}</span>
                    {value === name && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border px-5 py-4">
              <button
                onClick={() => setMode("search")}
                className="flex h-12 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3.5 text-left text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Or type a new name…
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
                  onKeyDown={handleKeyDown}
                  placeholder="Player name…"
                  className="h-12 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery("")
                      inputRef.current?.focus()
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground"
                    aria-label="Clear"
                  >
                    <span className="text-base">×</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border divide-y divide-border">
              {matches.map((name) => (
                <button
                  key={name}
                  onClick={() => pick(name)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-base font-semibold flex-1">{name}</span>
                  {value === name && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}

              {trimmed && !exactMatch && (
                <button
                  onClick={() => pick(trimmed)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/60 transition-colors"
                >
                  <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium">Use “{trimmed}”</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Add as a new player</div>
                  </div>
                </button>
              )}

              {!trimmed && matches.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Type a name to add a player.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
