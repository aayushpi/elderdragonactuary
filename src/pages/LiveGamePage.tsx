import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { Game } from "@/types"
import type { CommanderShortlistItem } from "@/lib/shortlist"
import { ThrowBoard } from "@/live/ThrowBoard"
import { useLiveGame, type LiveConfig } from "@/live/engine"
import { buildKnownPlayers, buildPlayerDecks, buildRecents, buildRichPods } from "@/live/setupData"
import { Setup } from "@/live/Setup"

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
  return (
    <>
      <ThrowBoard
        game={game}
        recents={recents}
        playerDecks={playerDecks}
        saving={saving}
        onSave={async () => {
          setSaving(true)
          try {
            await onSave(game.buildGame())
            toast.success("Game saved!")
          } catch {
            toast.error("Couldn't save game")
          }
          setSaving(false)
        }}
        onRematch={() => game.reset(config)}
      />
      <button
        onClick={onNewSetup}
        className="fixed left-1/2 top-1 z-[60] -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-0.5 text-[10px] font-medium text-background"
      >
        ⨯ new setup
      </button>
    </>
  )
}
