import { useEffect, useState } from "react"
import { Loader2, ArrowLeft, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { importDeck, DeckImportError, type ParsedDeck } from "@/lib/deckImport"
import { buildDeckFromParsed } from "@/lib/decks"
import { isFastMana } from "@/lib/fastMana"
import type { Deck } from "@/types"

interface DeckImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (deck: Deck) => Promise<void>
}

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function DeckImportDialog({ open, onOpenChange, onSave }: DeckImportDialogProps) {
  const [step, setStep] = useState<"input" | "preview">("input")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedDeck | null>(null)
  const [commanderName, setCommanderName] = useState("")
  const [partnerName, setPartnerName] = useState("")
  const [deckName, setDeckName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep("input")
      setInput("")
      setError(null)
      setParsed(null)
      setCommanderName("")
      setPartnerName("")
      setDeckName("")
      setLoading(false)
      setSaving(false)
    }
  }, [open])

  async function handleImport() {
    setError(null)
    setLoading(true)
    try {
      const result = await importDeck(input)
      setParsed(result)
      setCommanderName(result.commanders[0] ?? "")
      setPartnerName(result.commanders[1] ?? "")
      setDeckName(result.name ?? "")
      setStep("preview")
    } catch (e) {
      setError(e instanceof DeckImportError ? e.message : "Could not read that decklist. Try pasting the list as text.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!parsed || !commanderName.trim()) return
    setSaving(true)
    try {
      const deck = await buildDeckFromParsed({
        parsed,
        commanderName: commanderName.trim(),
        partnerName: partnerName.trim() || undefined,
        name: deckName.trim() || undefined,
      })
      await onSave(deck)
      onOpenChange(false)
    } catch {
      setError("Couldn't save the deck. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const fastManaCount = parsed?.cards.filter((c) => isFastMana(c.name)).length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "preview" && (
              <button
                type="button"
                onClick={() => setStep("input")}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {step === "input" ? "Import a deck" : "Confirm deck"}
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Paste a Moxfield/Archidekt link, or paste your decklist as text."
              : "We'll use these cards as defaults for fast mana and wincons when you log a game with this commander."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"https://www.moxfield.com/decks/…\n\n— or —\n\n1 Sol Ring\n1 Cyclonic Rift\n1 Rhystic Study\n…"}
              rows={8}
              className="font-mono text-xs"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || !input.trim()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <span className="font-medium">{parsed?.cards.length ?? 0}</span> cards ·{" "}
              <span className="font-medium">{fastManaCount}</span> fast mana detected
              {parsed?.source !== "text" && (
                <span className="ml-1 text-muted-foreground">· from {parsed?.source}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Commander <span className="text-destructive">*</span>
              </label>
              <input
                value={commanderName}
                onChange={(e) => setCommanderName(e.target.value)}
                placeholder="e.g. Kenrith, the Returned King"
                className={INPUT_CLASS}
              />
              {!commanderName.trim() && (
                <p className="text-xs text-muted-foreground">
                  We couldn't detect the commander — enter it so we can match this deck to your games.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Partner (optional)</label>
              <input
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Partner / background, if any"
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Deck name (optional)</label>
              <input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Defaults to the commander's name"
                className={INPUT_CLASS}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !commanderName.trim()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save deck
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
