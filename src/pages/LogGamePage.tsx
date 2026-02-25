import { useState, useMemo, useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { PlayerRow } from "@/components/PlayerRow"
import { CardSearch } from "@/components/CardSearch"
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
  "Asymmetric Board Wipe",
  "Poison or Infect"
] as const

function getMirroredSeatOrder(totalPlayers: number): number[] {
  if (totalPlayers < 1) return []

  if (totalPlayers === 5) {
    return [1, 2, 3, 5, 4]
  }

  if (totalPlayers === 6) {
    return [1, 2, 3, 6, 5, 4]
  }

  const rightEnd = Math.floor(totalPlayers / 2) + 1
  const leftSeats = [1]
  const rightSeats: number[] = []

  for (let seat = totalPlayers; seat >= rightEnd + 1; seat--) {
    leftSeats.push(seat)
  }
  for (let seat = 2; seat <= rightEnd; seat++) {
    rightSeats.push(seat)
  }

  const mirrored: number[] = []
  const rows = Math.max(leftSeats.length, rightSeats.length)
  for (let i = 0; i < rows; i++) {
    if (leftSeats[i] !== undefined) mirrored.push(leftSeats[i])
    if (rightSeats[i] !== undefined) mirrored.push(rightSeats[i])
  }
  return mirrored
}

const EMPTY_ERRORS: FormErrors = { playerCount: false, players: [], noWinner: false, winTurn: false }

interface LogGamePageProps {
  onSave: (game: Game) => void
  onCancel: () => void
}

export function LogGamePage({ onSave, onCancel }: LogGamePageProps) {
  const { games } = useGames()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateMobileState = () => setIsMobile(mediaQuery.matches)

    updateMobileState()
    mediaQuery.addEventListener("change", updateMobileState)
    return () => mediaQuery.removeEventListener("change", updateMobileState)
  }, [])

  const recentMyCommanders = useMemo((): RecentCommander[] => {
    const seen = new Set<string>()
    const result: RecentCommander[] = []
    for (const game of games) {
      const me = game.players.find((p) => p.isMe)
      if (!me || seen.has(me.commanderName) || !me.commanderManaCost) continue
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
  const [keyWinconCards, setKeyWinconCards] = useState<string[]>([])
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
      keyWinconCards: keyWinconCards.length > 0 ? keyWinconCards : undefined,
    }
    onSave(game)
  }

  const totalPlayers = playerCount ?? 0
  // Desktop-only table mirroring: mobile keeps original card layout static.
  const playerGridColumns = isMobile ? 2 : totalPlayers >= 5 ? 3 : 2
  const mirroredSeatIndex = useMemo(() => {
    const mirroredOrder = getMirroredSeatOrder(totalPlayers)
    return new Map(mirroredOrder.map((seat, index) => [seat, index]))
  }, [totalPlayers])

  const sortedPlayerEntries = useMemo(() => {
    // Mobile behavior: preserve initial visual order; seat choice is logged only.
    if (isMobile) {
      return players.map((player, originalIndex) => ({
        player,
        originalIndex,
        playerOrder: originalIndex + 1,
      }))
    }

    const seatByPlayerId = new Map<string, number>()

    const assignedSeats = players
      .map((player) => player.seatPosition)
      .filter((seat): seat is SeatPosition => seat !== undefined)
    const assignedSeatSet = new Set(assignedSeats)

    const allPossibleSeats: SeatPosition[] = [1, 2, 3, 4, 5, 6]
    const remainingSeats: SeatPosition[] = []
    for (const seat of allPossibleSeats.slice(0, totalPlayers)) {
      if (!assignedSeatSet.has(seat)) {
        remainingSeats.push(seat)
      }
    }

    let remainingSeatIndex = 0
    for (const player of players) {
      const playerId = player.id
      if (!playerId) continue

      if (player.seatPosition !== undefined) {
        seatByPlayerId.set(playerId, player.seatPosition)
      } else {
        const fallbackSeat = remainingSeats[remainingSeatIndex] ?? totalPlayers
        seatByPlayerId.set(playerId, fallbackSeat)
        remainingSeatIndex += 1
      }
    }

    return players
      .map((player, originalIndex) => ({ player, originalIndex }))
      .sort((a, b) => {
        const aSeat = a.player.id ? seatByPlayerId.get(a.player.id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
        const bSeat = b.player.id ? seatByPlayerId.get(b.player.id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
        const aPosition = mirroredSeatIndex.get(aSeat) ?? Number.MAX_SAFE_INTEGER
        const bPosition = mirroredSeatIndex.get(bSeat) ?? Number.MAX_SAFE_INTEGER
        return aPosition - bPosition || a.originalIndex - b.originalIndex
      })
      .map((entry, index) => {
        const seatOrder = entry.player.id ? seatByPlayerId.get(entry.player.id) : undefined
        return { ...entry, playerOrder: seatOrder ?? (index + 1) }
      })
  }, [players, mirroredSeatIndex, totalPlayers, isMobile])

  const playerGridEntries = useMemo(() => {
    // Mobile behavior: do not inject placeholder slots for mirrored alignment.
    if (isMobile) {
      return sortedPlayerEntries
    }

    const remainder = sortedPlayerEntries.length % playerGridColumns
    if (remainder === 0) return sortedPlayerEntries

    const emptySlots = playerGridColumns - remainder
    const tailStart = sortedPlayerEntries.length - remainder
    return [
      ...sortedPlayerEntries.slice(0, tailStart),
      ...Array.from({ length: emptySlots }, () => null),
      ...sortedPlayerEntries.slice(tailStart),
    ]
  }, [sortedPlayerEntries, playerGridColumns, isMobile])

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
            <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : playerGridColumns === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {playerGridEntries.map((entry, gridIndex) => {
                if (!entry) {
                  return <div key={`empty-slot-${gridIndex}`} aria-hidden="true" />
                }

                const { player, originalIndex, playerOrder } = entry
                return (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    isMe={player.isMe ?? false}
                    playerOrder={playerOrder}
                    takenSeats={takenSeats(originalIndex)}
                    totalPlayers={totalPlayers}
                    isWinner={player.id === winnerId}
                    winTurn={player.id === winnerId ? winTurn : ""}
                    onSetWinner={() => { setWinnerId(player.id ?? null); setWinTurn("") }}
                    onWinTurnChange={setWinTurn}
                    onChange={(updated) => updatePlayer(originalIndex, updated)}
                    recentCommanders={player.isMe ? recentMyCommanders : undefined}
                    fieldErrors={{
                      commanderName: errors.players[originalIndex]?.commanderName,
                      seatPosition: errors.players[originalIndex]?.seatPosition,
                      winTurn: player.id === winnerId ? errors.winTurn : false,
                    }}
                    showWinnerError={errors.noWinner}
                  />
                )
              })}
            </div>
          </div>

          {/* Key Wincon Cards */}
          <Separator />
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Key wincon cards (Optional)
              </label>
            </div>
            <CardSearch
              selectedCards={keyWinconCards}
              onAddCard={(cardName) => setKeyWinconCards(prev => [...prev, cardName])}
              onRemoveCard={(cardName) => setKeyWinconCards(prev => prev.filter(c => c !== cardName))}
              placeholder="Search for key wincon cards…"
            />
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
