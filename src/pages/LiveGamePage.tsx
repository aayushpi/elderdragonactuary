import { useMemo, useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"
import type { CommanderShortlistItem } from "@/lib/shortlist"
import { CardSearch } from "@/components/CardSearch"
import { ThrowBoard } from "@/live/ThrowBoard"
import { useLiveGame, type LiveConfig, type LivePlayer } from "@/live/engine"
import { buildKnownPlayers, buildPlayerDecks, buildRecents, buildRichPods } from "@/live/setupData"
import { Setup } from "@/live/Setup"

const WINCON_OPTIONS = [
  "Commander Damage",
  "Lethal Combat Damage",
  "Combat Trick",
  "Lethal Non-Combat Damage",
  "Players Decked Out",
  "Alternate Wincon",
  "Infinite Loop",
  "Infinite Life-Gain",
  "Infinite Mana",
  "Asymmetric Board Wipe",
  "Poison or Infect",
]

const BRACKET_OPTIONS = [1, 2, 3, 4, 5]

interface WinconSaveInfo {
  winConditions: string[]
  keyWinconCards: string[]
  notes: string
  bracket: number | null
  fastMana: Record<string, boolean>
}

function WinconEntry({
  winner,
  players,
  onSave,
  onSkip,
  saving,
}: {
  winner: LivePlayer | null
  players: LivePlayer[]
  onSave: (info: WinconSaveInfo) => void
  onSkip: () => void
  saving?: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [keyCards, setKeyCards] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [bracket, setBracket] = useState<number | null>(null)
  const [fastMana, setFastMana] = useState<Record<string, boolean>>({})

  function toggleWincon(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((p) => p !== option) : [...prev, option]
    )
  }

  function toggleFastMana(playerId: string) {
    setFastMana((prev) => ({ ...prev, [playerId]: !prev[playerId] }))
  }

  function handleSave() {
    onSave({ winConditions: selected, keyWinconCards: keyCards, notes, bracket, fastMana })
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 overflow-y-auto">
      <div className="my-4 w-[min(90vw,22rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
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
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Win conditions</p>
            <div className="flex flex-wrap gap-2">
              {WINCON_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => toggleWincon(option)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    selected.includes(option)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Key wincon cards</p>
            <CardSearch
              selectedCards={keyCards}
              onAddCard={(card) => setKeyCards((prev) => [...prev, card])}
              onRemoveCard={(card) => setKeyCards((prev) => prev.filter((c) => c !== card))}
              placeholder="Search for a card…"
            />
          </div>

          {players.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Fast mana</p>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleFastMana(p.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      fastMana[p.id]
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Game bracket (optional)
            </p>
            <div className="flex gap-1.5">
              {BRACKET_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBracket(bracket === b ? null : b)}
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
                    bracket === b
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notes (optional)</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this game…"
              className="min-h-[72px] resize-none text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onSkip}>
              Skip
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              Save & continue
            </Button>
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

  async function doSave(info?: WinconSaveInfo) {
    setSaving(true)
    try {
      const built = game.buildGame()
      const final: Game = {
        ...built,
        winConditions: info?.winConditions?.length ? info.winConditions : undefined,
        keyWinconCards: info?.keyWinconCards?.length ? info.keyWinconCards : undefined,
        notes: info?.notes?.trim() || undefined,
        bracket: info?.bracket ?? undefined,
        players: info?.fastMana
          ? built.players.map((p) => ({ ...p, fastMana: { hasFastMana: !!info.fastMana[p.id], cards: [] } }))
          : built.players,
      }
      await onSave(final)
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
        onDiscard={onNewSetup}
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
          players={game.players}
          saving={saving}
          onSave={(info) => void doSave(info)}
          onSkip={() => void doSave()}
        />
      )}
    </>
  )
}
