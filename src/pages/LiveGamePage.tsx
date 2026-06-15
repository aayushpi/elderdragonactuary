import { useMemo, useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"
import type { CommanderShortlistItem } from "@/lib/shortlist"
import { ThrowBoard } from "@/live/ThrowBoard"
import { useLiveGame, type LiveConfig, type LivePlayer } from "@/live/engine"
import { buildKnownPlayers, buildPlayerDecks, buildRecents, buildRichPods } from "@/live/setupData"
import { Setup } from "@/live/Setup"

const WINCON_PRESETS = [
  "Commander damage",
  "Infect/Poison",
  "Alt wincon",
  "Last standing",
  "Combo",
  "Card advantage",
]

function WinconEntry({
  winner,
  onSave,
  onSkip,
  saving,
}: {
  winner: LivePlayer | null
  onSave: (winConditions: string[], keyWinconCards: string[]) => void
  onSkip: () => void
  saving?: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [cardsText, setCardsText] = useState("")

  function toggle(preset: string) {
    setSelected((prev) => prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset])
  }

  function handleSave() {
    const cards = cardsText.split(",").map((s) => s.trim()).filter(Boolean)
    onSave(selected, cards)
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70">
      <div className="w-[min(90vw,22rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-semibold text-sm">How did {winner?.displayName ?? "the winner"} win?</p>
            <p className="text-xs text-muted-foreground">Optional — helps track win patterns</p>
          </div>
          <button onClick={onSkip} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {WINCON_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => toggle(p)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected.includes(p)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Key cards (comma-separated)</label>
            <input
              value={cardsText}
              onChange={(e) => setCardsText(e.target.value)}
              placeholder="e.g. Thassa's Oracle, Demonic Tutor"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onSkip}>Skip</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>Save & continue</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Live (at-the-table) game: pick the table → play on the centred board with
 * commanders set in-game. Setup data is derived from real game history. */
export function LiveGamePage({
  games,
  onSaveGame,
  onExit,
}: {
  games: Game[]
  onSaveGame: (game: Game) => Promise<void> | void
  onExit: () => void
}) {
  const pods = useMemo(() => buildRichPods(games), [games])
  const recents = useMemo(() => buildRecents(games), [games])
  const knownPlayers = useMemo(() => buildKnownPlayers(games), [games])
  const playerDecks = useMemo(() => buildPlayerDecks(games), [games])

  const [config, setConfig] = useState<LiveConfig | null>(null)
  const [gameKey, setGameKey] = useState(0)

  if (!config) {
    return (
      <Setup
        pods={pods}
        knownPlayers={knownPlayers}
        onStart={(c) => {
          setConfig(c)
          setGameKey((k) => k + 1)
        }}
        onExit={onExit}
      />
    )
  }

  return (
    <PlayingBoard
      key={gameKey}
      config={config}
      recents={recents}
      playerDecks={playerDecks}
      onSave={onSaveGame}
      onNewSetup={() => setConfig(null)}
    />
  )
}

function PlayingBoard({
  config,
  recents,
  playerDecks,
  onSave,
  onNewSetup,
}: {
  config: LiveConfig
  recents: CommanderShortlistItem[]
  playerDecks: Record<string, CommanderShortlistItem[]>
  onSave: (game: Game) => Promise<void> | void
  onNewSetup: () => void
}) {
  const game = useLiveGame(config)
  const [saving, setSaving] = useState(false)
  const [pendingWincon, setPendingWincon] = useState(false)

  const winner = game.winnerId ? game.players.find((p) => p.id === game.winnerId) ?? null : null

  async function doSave(winConditions?: string[], keyWinconCards?: string[]) {
    setSaving(true)
    try {
      const built = game.buildGame()
      await onSave({ ...built, winConditions, keyWinconCards })
      toast.success("Game saved!")
    } catch {
      toast.error("Couldn't save game")
    }
    setSaving(false)
    setPendingWincon(false)
  }

  return (
    <>
      <ThrowBoard
        game={game}
        recents={recents}
        playerDecks={playerDecks}
        saving={saving}
        onSave={() => setPendingWincon(true)}
        onRematch={() => { setPendingWincon(false); game.reset(config) }}
      />
      <button
        onClick={onNewSetup}
        className="fixed left-1/2 top-1 z-[60] -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-0.5 text-[10px] font-medium text-background"
      >
        ⨯ new setup
      </button>
      {pendingWincon && (
        <WinconEntry
          winner={winner}
          saving={saving}
          onSave={(wc, cards) => void doSave(wc, cards)}
          onSkip={() => void doSave()}
        />
      )}
    </>
  )
}
