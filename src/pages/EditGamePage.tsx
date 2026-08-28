import { useState, useMemo, useEffect } from "react"
import { AlertCircle, ExternalLink, ChevronsUpDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { PlayerRow } from "@/components/PlayerRow"
import { WinconCardPicker } from "@/components/WinconCardPicker"
import { buildPlayerShortlists, buildWinconShortlist } from "@/lib/shortlist"
import { useGames } from "@/hooks/useGames"
import { hasInvalidKoTiming } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { copy } from "@/copy"
import type { Game, Player, SeatPosition } from "@/types"
import { createPodIfMissing, saveProfileDisplayName, loadProfile } from "@/lib/storage"

interface PlayerFieldErrors {
  commanderName: boolean
  seatPosition: boolean
}

interface FormErrors {
  playerCount: boolean
  players: PlayerFieldErrors[]
  noWinner: boolean
  winTurn: boolean
  koTiming: boolean
}

const WIN_CONDITION_CATEGORIES = copy.logGame.winConditions

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

const EMPTY_ERRORS: FormErrors = { playerCount: false, players: [], noWinner: false, winTurn: false, koTiming: false }

interface EditGamePageProps {
  game: Game
  onSave: (game: Game) => void
  onCancel: () => void
  onDelete?: () => void
}

export function EditGamePage({ game, onSave, onCancel, onDelete }: EditGamePageProps) {
  const { games } = useGames()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateMobileState = () => setIsMobile(mediaQuery.matches)

    updateMobileState()
    mediaQuery.addEventListener("change", updateMobileState)
    return () => mediaQuery.removeEventListener("change", updateMobileState)
  }, [])

  const { myShortlist, opponentShortlists } = useMemo(() => buildPlayerShortlists(games), [games])

  // Derive unique opponent names from game history for autocomplete
  const knownPlayerNames = useMemo((): string[] => {
    const names = new Set<string>()
    for (const g of games) {
      for (const p of g.players) {
        if (!p.isMe && p.displayName?.trim()) {
          names.add(p.displayName.trim())
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [games])

  // Initialize from existing game — prefill "me" displayName from profile if missing
  const initialPlayers = useMemo(() => {
    const profile = loadProfile()
    return game.players.map((p) => {
      if (p.isMe && !p.displayName && profile.displayName) {
        return { ...p, displayName: profile.displayName }
      }
      return p
    })
  }, [game.players])

  const [playerCount] = useState<number>(game.players.length)
  const [players, setPlayers] = useState<Partial<Player>[]>(initialPlayers)
  const [winnerId, setWinnerId] = useState<string | null>(game.winnerId)
  const [winTurn, setWinTurn] = useState(game.winTurn.toString())
  const [clearedKoTurnPlayerIds, setClearedKoTurnPlayerIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState(game.notes || "")
  const [winConditions, setWinConditions] = useState<string[]>(game.winConditions || [])
  const [keyWinconCards, setKeyWinconCards] = useState<string[]>(game.keyWinconCards || [])
  const [winconPickerOpen, setWinconPickerOpen] = useState(false)
  const winconShortlist = useMemo(() => buildWinconShortlist(games), [games])
  const [bracket, setBracket] = useState<number | null>(game.bracket ?? null)
  const [showBracketSelector, setShowBracketSelector] = useState(!!game.bracket)
  const [errors, setErrors] = useState<FormErrors>(EMPTY_ERRORS)

  function updatePlayer(index: number, updated: Partial<Player>) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...updated } : p)))
    if (index === 0 && (typeof updated.commanderName === "string" || typeof updated.displayName === "string")) {
      const name = typeof updated.displayName === "string" ? updated.displayName : updated.commanderName
      saveProfileDisplayName(name)
    }
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
    const hasKoTimingError = hasInvalidKoTiming(players, winnerId, winTurn)

    const newErrors: FormErrors = {
      playerCount: false, // We don't allow changing player count in edit mode
      players: players.map((p) => ({
        commanderName: !p.commanderName?.trim(),
        seatPosition: !p.seatPosition || (seatCounts.get(p.seatPosition!) ?? 0) > 1,
      })),
      noWinner: !winnerId,
      winTurn: !!winnerId && (!winTurn || isNaN(turn) || turn < 1),
      koTiming: hasKoTimingError,
    }

    const hasError = newErrors.players.some((p) => p.commanderName || p.seatPosition)
      || newErrors.noWinner
      || newErrors.winTurn
      || newErrors.koTiming

    setErrors(hasError ? newErrors : EMPTY_ERRORS)
    return !hasError
  }

  function getKoTurnValue(player: Partial<Player>): string {
    if (!winnerId || player.id === winnerId) return ""
    if (typeof player.knockoutTurn === "number") return player.knockoutTurn.toString()
    if (player.id && clearedKoTurnPlayerIds.has(player.id)) return ""
    return winTurn
  }

  function handleKoTurnChange(index: number, turn: string) {
    const playerId = players[index]?.id
    if (!playerId) return

    const trimmed = turn.trim()
    if (!trimmed) {
      setClearedKoTurnPlayerIds((prev) => new Set(prev).add(playerId))
      updatePlayer(index, { knockoutTurn: undefined })
      return
    }

    const parsed = parseInt(trimmed, 10)
    if (isNaN(parsed) || parsed < 1) {
      updatePlayer(index, { knockoutTurn: undefined })
      return
    }

    setClearedKoTurnPlayerIds((prev) => {
      const next = new Set(prev)
      next.delete(playerId)
      return next
    })
    updatePlayer(index, { knockoutTurn: parsed })
  }

  function handleSubmit() {
    if (!validate()) return
    const winningTurn = parseInt(winTurn, 10)
    const finalizedPlayers = players.map((player) => {
      if (player.id === winnerId) return { ...player, knockoutTurn: undefined }
      if (!player.id) return player
      if (typeof player.knockoutTurn === "number") return player
      if (clearedKoTurnPlayerIds.has(player.id)) return { ...player, knockoutTurn: undefined }
      return { ...player, knockoutTurn: winningTurn }
    })

    const updatedGame: Game = {
      ...game, // Keep original id and playedAt
      players: finalizedPlayers as Player[],
      winnerId: winnerId!,
      winTurn: winningTurn,
      notes: notes.trim() || undefined,
      winConditions: winConditions.length > 0 ? winConditions : undefined,
      keyWinconCards: keyWinconCards.length > 0 ? keyWinconCards : undefined,
      bracket: bracket ?? undefined,
    }
    // Build playerNames map when all players have explicit display names
    const names = finalizedPlayers.map((p) => p.displayName?.trim() ?? "")
    const allNamed = names.every((n) => n.length > 0)
    if (allNamed) {
      const playerNamesMap: Record<string, string> = {}
      finalizedPlayers.forEach((p) => {
        if (p.id && p.displayName?.trim()) {
          playerNamesMap[p.id] = p.displayName.trim()
        }
      })
      updatedGame.playerNames = playerNamesMap
    } else {
      updatedGame.playerNames = undefined
    }
    onSave(updatedGame)
    // Create a pod only if all players have explicit player names (`displayName`)
    createPodIfMissing(names)
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

  const hasAnyError = errors.players.some((p) => p.commanderName || p.seatPosition)
    || errors.noWinner
    || errors.winTurn
    || errors.koTiming

  const formErrorMessage = errors.koTiming
    ? copy.logGame.errorKoTiming
    : copy.logGame.errorGeneric

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      <div>
        <h1 className="text-2xl font-bold">Edit Game</h1>
        <p className="text-muted-foreground text-sm mt-1">Update game details</p>
      </div>

      {/* Player rows */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.logGame.playersHeading}
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
                showKoTurnControls={!!winnerId}
                winTurn={player.id === winnerId ? winTurn : ""}
                koTurn={getKoTurnValue(player)}
                onSetWinner={() => { setWinnerId(player.id ?? ""); setWinTurn("") }}
                onWinTurnChange={setWinTurn}
                onKoTurnChange={(turn) => handleKoTurnChange(originalIndex, turn)}
                onChange={(updated) => updatePlayer(originalIndex, updated)}
                shortlist={
                  player.isMe
                    ? myShortlist
                    : player.displayName?.trim()
                      ? opponentShortlists.get(player.displayName.trim().toLowerCase())
                      : undefined
                }
                pickerLabel={player.isMe ? "You" : player.displayName?.trim() || undefined}
                seatLabel={copy.logGame.seatLabel(player.seatPosition ?? playerOrder)}
                knownPlayerNames={knownPlayerNames}
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

      {/* Bracket Selector */}
      <Separator />
      <div className="space-y-2">
        {!showBracketSelector ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowBracketSelector(true)}
            className="w-full"
          >
            {copy.logGame.addBracket}
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {copy.logGame.bracketHeading}
              </h2>
              <a
                href="https://magic.wizards.com/en/formats/commander#brackets"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                {copy.logGame.bracketLink}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={bracket === n ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setBracket(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Key Wincon Cards */}
      <Separator />
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            {copy.logGame.keyWinconCards}
          </label>
        </div>
        {keyWinconCards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keyWinconCards.map((cardName) => (
              <Badge key={cardName} variant="secondary" className="flex items-center gap-1">
                {cardName}
                <button
                  type="button"
                  onClick={() => setKeyWinconCards(prev => prev.filter(c => c !== cardName))}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  aria-label={copy.logGame.removeCard(cardName)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setWinconPickerOpen(true)}
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60"
        >
          <span className="truncate text-sm text-muted-foreground">Search for key wincon cards…</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <WinconCardPicker
          open={winconPickerOpen}
          onOpenChange={setWinconPickerOpen}
          items={winconShortlist}
          selectedCards={keyWinconCards}
          onAdd={(cardName) => setKeyWinconCards(prev => prev.includes(cardName) ? prev : [...prev, cardName])}
          onRemove={(cardName) => setKeyWinconCards(prev => prev.filter(c => c !== cardName))}
        />
      </div>

      {/* Win Conditions */}
      <Separator />
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            {copy.logGame.winConditionsHeading}
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
          {copy.logGame.notesLabel}
        </label>
        <Textarea
          id="notes"
          placeholder={copy.logGame.notesPlaceholder}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {hasAnyError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{formErrorMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          {copy.logGame.cancel}
        </Button>
        <Button className="flex-1" onClick={handleSubmit}>
          {copy.logGame.saveEdit}
        </Button>
      </div>
      {onDelete && (
        <div className="pt-1">
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            Delete game
          </Button>
        </div>
      )}
    </div>
  )
}
