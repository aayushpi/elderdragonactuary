import { useState, useMemo, useEffect, useRef } from "react"
import { AlertCircle, ExternalLink, ChevronsUpDown, X } from "lucide-react"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import type { MtgColor } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { PlayerRow } from "@/components/PlayerRow"
import { PodPicker } from "@/components/PodPicker"
import { buildPlayerShortlists, buildWinconShortlist } from "@/lib/shortlist"
import { WinconCardPicker } from "@/components/WinconCardPicker"
import { useGames } from "@/hooks/useGames"
import { hasInvalidKoTiming } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { copy } from "@/copy"
import type { Game, Player, SeatPosition } from "@/types"
import { saveProfileDisplayName, loadProfile } from "@/lib/storage"

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

interface LogGamePageProps {
  onSave: (game: Game) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  prefillCommander?: string
  /** sample history the walkthrough shows instead of an empty account's own */
  demoGames?: Game[]
}

export function LogGamePage({ onSave, onCancel, onDirtyChange, prefillCommander, demoGames }: LogGamePageProps) {
  const { games: myGames } = useGames()
  // The walkthrough hands in a sample pod so a brand-new account sees the pod
  // picker and commander suggestions this screen is built around.
  const games = demoGames ?? myGames
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateMobileState = () => setIsMobile(mediaQuery.matches)

    updateMobileState()
    mediaQuery.addEventListener("change", updateMobileState)
    return () => mediaQuery.removeEventListener("change", updateMobileState)
  }, [])

  // One-tap commander shortlists, keyed by who's playing. The me-player and
  // every named pod-mate we have history for get their own list — same picker
  // UX for everyone.
  const { myShortlist, opponentShortlists } = useMemo(() => buildPlayerShortlists(games), [games])

  // Opponent names from game history, ordered by how often I've played with
  // them so the most frequent pod-mates surface first in the name picker.
  const knownPlayerNames = useMemo((): string[] => {
    const counts = new Map<string, number>()
    for (const g of games) {
      for (const p of g.players) {
        if (!p.isMe && p.displayName?.trim()) {
          const name = p.displayName.trim()
          counts.set(name, (counts.get(name) ?? 0) + 1)
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name)
  }, [games])

  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [players, setPlayers] = useState<Partial<Player>[]>([])
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null)
  const [podsOpen, setPodsOpen] = useState(false)
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [winTurn, setWinTurn] = useState("")
  const [clearedKoTurnPlayerIds, setClearedKoTurnPlayerIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState("")
  const [winConditions, setWinConditions] = useState<string[]>([])
  const [keyWinconCards, setKeyWinconCards] = useState<string[]>([])
  const [winconPickerOpen, setWinconPickerOpen] = useState(false)
  const winconShortlist = useMemo(() => buildWinconShortlist(games), [games])
  const [bracket, setBracket] = useState<number | null>(null)
  const [showBracketSelector, setShowBracketSelector] = useState(false)
  const [errors, setErrors] = useState<FormErrors>(EMPTY_ERRORS)

  function initPlayers(total: number) {
    // if we were given a commander to prefill and this is the first
    // time players are being initialized, set the first player's
    // commander name accordingly
    const prefill = prefillCommander
    let newPlayers: Partial<Player>[]

    if (players.length === 0) {
      newPlayers = []
      const profile = loadProfile()
      for (let i = 0; i < total; i++) {
        const p = makePlayer(i === 0)
        if (i === 0 && prefill) {
          p.commanderName = prefill
        }
        if (i === 0 && profile.displayName) {
          p.displayName = profile.displayName
        }
        newPlayers.push(p)
      }

      // if we prefilling a commander, fetch card data for its image/stats
      if (prefill) {
        fetchCardByName(prefill)
          .then((card) => {
            const uri = resolveArtCrop(card)
            setPlayers((prev) => {
              const next = [...prev]
              if (next[0]) {
                next[0] = {
                  ...next[0],
                  commanderName: prefill,
                  commanderImageUri: uri ?? undefined,
                  commanderManaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
                  commanderTypeLine: card.type_line,
                  commanderColorIdentity: card.color_identity as MtgColor[],
                }
              }
              return next
            })
          })
          .catch(() => {})
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

    setClearedKoTurnPlayerIds((prev) => {
      const next = new Set<string>()
      for (const id of prev) {
        if (keptIds.has(id)) next.add(id)
      }
      return next
    })

    setPlayerCount(total)
    setPlayers(newPlayers)
    setErrors(EMPTY_ERRORS)
  }

  // Walkthrough only: fill the form from the sample pod's last game, so the
  // steps about seats, winner, and saving have a filled-in form to point at
  // instead of a collapsed empty one.
  const demoSeeded = useRef(false)
  useEffect(() => {
    const sample = demoGames?.[0]
    if (!sample || demoSeeded.current) return
    demoSeeded.current = true
    const seatIds = new Map<string, string>()
    const seeded = sample.players.map((p) => {
      const id = generateId()
      seatIds.set(p.id, id)
      return {
        id,
        isMe: p.isMe,
        displayName: p.displayName,
        commanderName: p.commanderName,
        commanderColorIdentity: p.commanderColorIdentity,
        seatPosition: p.seatPosition,
        fastMana: p.fastMana ?? { hasFastMana: false, cards: [] },
      } satisfies Partial<Player>
    })
    setPlayerCount(seeded.length)
    setPlayers(seeded)
    setWinnerId(seatIds.get(sample.winnerId) ?? null)
    setWinTurn(String(sample.winTurn))
  }, [demoGames])

  // Derive pods from game history: groups of named players that played together
  // Only opponent names are stored — the user is always implied.
  const pods = useMemo(() => {
    const map = new Map<string, { id: string; opponents: string[]; label: string; totalPlayers: number }>()
    for (const g of games) {
      const names = g.players.map((p) => p.displayName?.trim()).filter(Boolean) as string[]
      if (names.length !== g.players.length || names.length === 0) continue
      const key = [...names].sort((a, b) => a.localeCompare(b)).join("|||")
      if (!map.has(key)) {
        const opponents = g.players
          .filter((p) => !p.isMe)
          .map((p) => p.displayName!.trim())
          .sort((a, b) => a.localeCompare(b))
        map.set(key, { id: key, opponents, label: opponents.join(", "), totalPlayers: g.players.length })
      }
    }
    return Array.from(map.values())
  }, [games])

  function applyPod(pod: { id: string; opponents: string[]; totalPlayers: number }) {
    setSelectedPodId(pod.id)
    const total = pod.totalPlayers
    const profile = loadProfile()
    // Player 0 = me
    const meExisting = players[0]
    const mePlayer: Partial<Player> = {
      id: meExisting?.id ?? generateId(),
      isMe: true,
      displayName: profile.displayName || "",
      commanderName: meExisting?.commanderName ?? (prefillCommander || undefined),
      commanderImageUri: meExisting?.commanderImageUri,
      commanderManaCost: meExisting?.commanderManaCost,
      commanderTypeLine: meExisting?.commanderTypeLine,
      commanderColorIdentity: meExisting?.commanderColorIdentity,
      partnerName: meExisting?.partnerName,
      partnerImageUri: meExisting?.partnerImageUri,
      fastMana: meExisting?.fastMana ?? { hasFastMana: false, cards: [] },
      seatPosition: meExisting?.seatPosition,
      knockoutTurn: meExisting?.knockoutTurn,
    }
    // Remaining slots = opponents from pod
    const opponentPlayers: Partial<Player>[] = pod.opponents.map((name, i) => {
      const existing = players[i + 1]
      return {
        id: existing?.id ?? generateId(),
        isMe: false,
        displayName: name,
        commanderName: existing?.commanderName,
        commanderImageUri: existing?.commanderImageUri,
        commanderManaCost: existing?.commanderManaCost,
        commanderTypeLine: existing?.commanderTypeLine,
        commanderColorIdentity: existing?.commanderColorIdentity,
        partnerName: existing?.partnerName,
        partnerImageUri: existing?.partnerImageUri,
        fastMana: existing?.fastMana ?? { hasFastMana: false, cards: [] },
        seatPosition: existing?.seatPosition,
        knockoutTurn: existing?.knockoutTurn,
      }
    })
    const newPlayers = [mePlayer, ...opponentPlayers]
    setPlayerCount(total)
    setPlayers(newPlayers)
    // If we applied a pod onto an empty players array but have a prefill commander,
    // fetch its card data and populate the first player's commander fields.
    if (prefillCommander && (!players[0] || !players[0].commanderName)) {
      fetchCardByName(prefillCommander)
        .then((card) => {
          const uri = resolveArtCrop(card)
          setPlayers((prev) => {
            const next = [...prev]
            if (next[0]) {
              next[0] = {
                ...next[0],
                commanderName: prefillCommander,
                commanderImageUri: uri ?? undefined,
                commanderManaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
                commanderTypeLine: card.type_line,
                commanderColorIdentity: card.color_identity as MtgColor[],
              }
            }
            return next
          })
        })
        .catch(() => {})
    }
    setWinnerId(null)
    setWinTurn("")
  }

  function updatePlayer(index: number, updated: Partial<Player>) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...updated } : p)))
    // persist first player display name to local profile (only when displayName explicitly set)
    if (index === 0 && typeof updated.displayName === "string") {
      saveProfileDisplayName(updated.displayName)
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
      playerCount: !playerCount,
      players: players.map((p) => ({
        commanderName: !p.commanderName?.trim(),
        seatPosition: !p.seatPosition || (seatCounts.get(p.seatPosition!) ?? 0) > 1,
      })),
      noWinner: !winnerId,
      winTurn: !!winnerId && (!winTurn || isNaN(turn) || turn < 1),
      koTiming: hasKoTimingError,
    }

    const hasError = newErrors.playerCount
      || newErrors.players.some((p) => p.commanderName || p.seatPosition)
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

    const game: Game = {
      id: generateId(),
      playedAt: new Date().toISOString(),
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
      game.playerNames = playerNamesMap
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
    || errors.koTiming

  const hasPlayerDetails = players.some((player) =>
    Boolean(
      player.commanderName?.trim()
      || player.seatPosition
      || player.partnerName?.trim()
      || player.fastMana?.hasFastMana
      || (player.fastMana?.cards?.length ?? 0) > 0
      || typeof player.knockoutTurn === "number"
    )
  )

  const hasInProgressData =
    playerCount !== null
    || winnerId !== null
    || winTurn.trim().length > 0
    || notes.trim().length > 0
    || winConditions.length > 0
    || keyWinconCards.length > 0
    || bracket !== null
    || hasPlayerDetails

  useEffect(() => {
    onDirtyChange?.(hasInProgressData)
    return () => onDirtyChange?.(false)
  }, [hasInProgressData, onDirtyChange])

  const formErrorMessage = errors.koTiming
    ? copy.logGame.errorKoTiming
    : copy.logGame.errorGeneric

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      {/* Player count */}
      <div data-tour="log-pod" className="space-y-2">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${errors.playerCount ? "text-destructive" : "text-muted-foreground"}`}>
          {copy.logGame.playerCountHeading}
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
        {pods.length > 0 && (
          <div className="mt-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">{copy.logGame.podLabel}</label>
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setPodsOpen(true)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <span className="truncate text-sm">
                  {selectedPodId ? (pods.find((p) => p.id === selectedPodId)?.label ?? copy.logGame.podPlaceholder) : copy.logGame.podPlaceholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
              </button>
              <PodPicker
                open={podsOpen}
                onOpenChange={setPodsOpen}
                pods={pods}
                value={selectedPodId}
                onPick={applyPod}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bracket Selector */}
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

      {/* Player rows */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          players.length > 0
            ? "max-h-[240rem] opacity-100 translate-y-0"
            : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
        )}
        aria-hidden={players.length === 0}
      >
        <>
          <Separator />
          <div data-tour="log-players" className="space-y-3">
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
                    onSetWinner={() => { setWinnerId(player.id ?? null); setWinTurn("") }}
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
                    seatLabel={player.seatPosition ? `Seat ${player.seatPosition}` : `Seat ${playerOrder}`}
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
              <span className="truncate text-sm text-muted-foreground">{copy.logGame.winconSearchPlaceholder}</span>
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
        </>
      </div>

      {hasAnyError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{formErrorMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div data-tour="log-save" className="flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            {copy.logGame.cancel}
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={players.length === 0}>
            {copy.logGame.save}
          </Button>
        </div>
      </div>
    </div>
  )
}
