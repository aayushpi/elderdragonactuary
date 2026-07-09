import { useEffect, useMemo, useRef, useState } from "react"
import { User, Check, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { SECTION_LABEL, SHEET_CONTENT_CLASS } from "@/components/modern/primitives"
import { useKeyboardInset } from "@/hooks/useKeyboardInset"

interface PlayerNamePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Saved player names, already ordered most-played-with first by the caller. */
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
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboardInset = useKeyboardInset()

  useEffect(() => {
    if (open) setDraft("")
  }, [open])

  const trimmed = draft.trim()

  // Typing in the add bar doubles as a filter over the saved list.
  const filtered = useMemo(() => {
    if (!trimmed) return names
    const q = trimmed.toLowerCase()
    return names.filter((n) => n.toLowerCase().includes(q))
  }, [names, trimmed])

  const exactMatch = names.some((n) => n.toLowerCase() === trimmed.toLowerCase())

  function pick(name: string) {
    onPick(name)
    onOpenChange(false)
  }

  function addDraft() {
    if (!trimmed) return
    pick(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={SHEET_CONTENT_CLASS}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          // Nothing to tap without saved names — jump straight to typing.
          if (names.length === 0) inputRef.current?.focus()
        }}
      >
        <DialogHeader className="space-y-1 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Pick a player</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {[seatLabel, "tap a saved name or add a new one"].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between px-5 pb-2 pt-1">
          <span className={SECTION_LABEL}>Saved players</span>
          <span className="font-mono text-[11px] text-muted-foreground">most played first</span>
        </div>

        {/* Inset padding keeps the last rows reachable when the keyboard
            overlays the sheet (iOS) instead of shrinking it. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto border-t border-border"
          style={{ paddingBottom: keyboardInset }}
        >
          <div className="divide-y divide-border">
            {filtered.map((name) => (
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
            {filtered.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                {names.length === 0 ? "No saved players yet." : "No saved players match."}
              </p>
            )}
          </div>
        </div>

        {/* Pinned add bar — type a new name and add it. Rides up with the
            keyboard on iOS, where the overlay would otherwise cover it. */}
        <div
          className="border-t border-border bg-background px-5 py-4 transition-transform"
          style={{ transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined }}
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addDraft()
                }
              }}
              placeholder="Add a new name…"
              className="h-12 flex-1 rounded-lg border border-input bg-card px-3.5 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={addDraft}
              disabled={!trimmed || exactMatch}
              className="flex h-12 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
