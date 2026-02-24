import { useState, useMemo } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { PlayerRow } from "@/components/PlayerRow"
import { useGames } from "@/hooks/useGames"
import { cn } from "@/lib/utils"
import type { Game, Player, RecentCommander, SeatPosition } from "@/types"

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function makePlayer(isMe: boolean): Partial<Player> {
  return {
    id: generateId(),
    isMe,
    commanderName: "",
    fastMana: { hasFastMana: false, cards: [] },
    // seatPosition intentionally omitted — user selects via SeatPicker
  }
}

interface PlayerFieldErrors {
  commanderName: boolean
  seatPosition: boolean
}

interface FormErrors {
  playerCount: boolean
  players: PlayerFieldErrors[]
  noWinner: boolean
  winTurn: boolean
}

const WIN_CONDITION_CATEGORIES = [
  "Players Scooped",
  "Lethal Combat Damage",
  "Combat Trick",
  "Lethal Non-Combat Damage",
  "Players Decked Out",
  "Alternate Wincon",
  "Infinite Loop",
  "Infinite Life-Gain",
  "Infinite Mana",
  "Asymmetric Board Wipe"
] as const

const EMPTY_ERRORS: FormErrors = { playerCount: false, players: [], noWinner: false, winTurn: false }

interface LogGamePageProps {
  onSave: (game: Game) => void
  onCancel: () => void
}

export function LogGamePage({ onSave, onCancel }: LogGamePageProps) {
  const { games } = useGames()

  const recentMyCommanders = useMemo((): RecentCommander[] => {
    const seen = new Set<string>()
    const result: RecentCommander[] = []
    for (const game of games) {
      const me = game.players.find((p) => p.isMe)
      if (!me || seen.has(me.commanderName)) continue
      seen.add(me.commanderName)
      result.push({
        name: me.commanderName,
        manaCost: me.commanderManaCost,
        imageUri: me.commanderImageUri,
        typeLine: me.commanderTypeLine,
        colorIdentity: me.commanderColorIdentity,
      })
    }
    return result
  }, [games])

  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [players, setPlayers] = useState<Partial<Player>[]>([])
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [winTurn, setWinTurn] = useState("")
  const [notes, setNotes] = useState("")
  const [winConditions, setWinConditions] = useState<string[]>([])
  const [errors, setErrors] = useState<FormErrors>(EMPTY_ERRORS)

  function initPlayers(total: number) {
    let newPlayers: Partial<Player>[]

    if (players.length === 0) {
      newPlayers = []
      for (let i = 0; i < total; i++) {
        newPlayers.push(makePlayer(i === 0))
      }
    } else if (total > players.length) {
      newPlayers = [...players]
      for (let i = players.length; i < total; i++) {
        newPlayers.push(makePlayer(false))
      }
    } else {
      newPlayers = players.slice(0, total).map((p) => ({
        ...p,
        seatPosition: p.seatPosition !== undefined && p.seatPosition <= total
          ? p.seatPosition
          : undefined,
      }))
    }

    const keptIds = new Set(newPlayers.map((p) => p.id))
    if (winnerId && !keptIds.has(winnerId)) {
      setWinnerId(null)
      setWinTurn("")
    }

    setPlayerCount(total)
    setPlayers(newPlayers)
    setErrors(EMPTY_ERRORS)
  }

  function updatePlayer(index: number, updated: Partial<Player>) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...updated } : p)))
  }

  function takenSeats(excludeIndex: number): SeatPosition[] {
    return players
      .filter((_, i) => i !== excludeIndex)
      .map((p) => p.seatPosition)
      .filter((s): s is SeatPosition => s !== undefined)
  }

  function validate(): boolean {
    const seatCounts = new Map<number, number>()
    players.forEach((p) => {
      if (p.seatPosition) seatCounts.set(p.seatPosition, (seatCounts.get(p.seatPosition) ?? 0) + 1)
    })

    const turn = parseInt(winTurn, 10)
    const newErrors: FormErrors = {
      playerCount: !playerCount,
      players: players.map((p) => ({
        commanderName: !p.commanderName?.trim(),
        seatPosition: !p.seatPosition || (seatCounts.get(p.seatPosition!) ?? 0) > 1,
      })),
      noWinner: !winnerId,
      winTurn: !!winnerId && (!winTurn || isNaN(turn) || turn < 1),
    }

    const hasError = newErrors.playerCount
      || newErrors.players.some((p) => p.commanderName || p.seatPosition)
      || newErrors.noWinner
      || newErrors.winTurn

    setErrors(hasError ? newErrors : EMPTY_ERRORS)
    return !hasError
  }

  function handleSubmit() {
    if (!validate()) return
    const game: Game = {
      id: generateId(),
      playedAt: new Date().toISOString(),
      players: players as Player[],
      winnerId: winnerId!,
      winTurn: parseInt(winTurn, 10),
      notes: notes.trim() || undefined,
      winConditions: winConditions.length > 0 ? winConditions : undefined,
    }
    onSave(game)
  }

  const totalPlayers = playerCount ?? 0
  const hasAnyError = errors.playerCount
    || errors.players.some((p) => p.commanderName || p.seatPosition)
    || errors.noWinner
    || errors.winTurn

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Log Game</h1>
        <p className="text-muted-foreground text-sm mt-1">Record a Commander game</p>
      </div>

      {/* Player count */}
      <div className="space-y-2">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${errors.playerCount ? "text-destructive" : "text-muted-foreground"}`}>
          How many players?
        </h2>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <Button
              key={n}
              type="button"
              variant={playerCount === n ? "default" : "outline"}
              className={`flex-1 ${errors.playerCount && playerCount !== n ? "border-destructive" : ""}`}
              onClick={() => initPlayers(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {/* Player rows */}
      {players.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Players
            </h2>
            <div className="grid grid-cols-2 gap-3">
            {players.map((player, i) => (
              <PlayerRow
                key={player.id}
                player={player}
                isMe={i === 0}
                opponentIndex={i > 0 ? i : undefined}
                takenSeats={takenSeats(i)}
                totalPlayers={totalPlayers}
                isWinner={player.id === winnerId}
                winTurn={player.id === winnerId ? winTurn : ""}
                onSetWinner={() => { setWinnerId(player.id ?? null); setWinTurn("") }}
                onWinTurnChange={setWinTurn}
                onChange={(updated) => updatePlayer(i, updated)}
                recentCommanders={i === 0 ? recentMyCommanders : undefined}
                fieldErrors={{
                  commanderName: errors.players[i]?.commanderName,
                  seatPosition: errors.players[i]?.seatPosition,
                  winTurn: player.id === winnerId ? errors.winTurn : false,
                }}
                showWinnerError={errors.noWinner}
              />
            ))}
            </div>
          </div>

          {/* Win Conditions */}
          <Separator />
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                How did they win (Optional)
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {WIN_CONDITION_CATEGORIES.map((condition) => (
                <button
                  key={condition}
                  type="button"
                  onClick={() => {
                    setWinConditions(prev =>
                      prev.includes(condition)
                        ? prev.filter(c => c !== condition)
                        : [...prev, condition]
                    )
                  }}
                  className={cn(
                    "px-3 py-2 text-xs rounded-md border transition-colors whitespace-nowrap",
                    winConditions.includes(condition)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {condition}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <Separator />
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide" htmlFor="notes">
              Notes (optional)
            </label>
            <Textarea
              id="notes"
              placeholder="Any additional notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </>
      )}

      {hasAnyError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Please fill in all highlighted fields.</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={players.length === 0}>
          Save Game
        </Button>
      </div>
    </div>
  )
}
