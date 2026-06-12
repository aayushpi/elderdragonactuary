import { useState, useMemo, useEffect, useRef } from "react"
import { AlertCircle, ExternalLink, ChevronsUpDown, Swords } from "lucide-react"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import type { MtgColor } from "@/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Command, CommandList, CommandItem, CommandInput } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { PlayerRow } from "@/components/PlayerRow"
import type { CommanderShortlistItem } from "@/components/CommanderPicker"
import { CardSearch } from "@/components/CardSearch"
import { useGames } from "@/hooks/useGames"
import { hasInvalidKoTiming } from "@/lib/validation"
import { cn } from "@/lib/utils"
import type { Game, Player, RecentCommander, SeatPosition } from "@/types"
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

const WIN_CONDITION_CATEGORIES = [
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

const EMPTY_ERRORS: FormErrors = { playerCount: false, players: [], noWinner: false, winTurn: false, koTiming: false }

interface LivePrefillResult {
  players: Partial<Player>[]
  winTurn: number
  winnerId?: string
}

interface LogGamePageProps {
  onSave: (game: Game) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  prefillCommander?: string
  prefillLiveResult?: LivePrefillResult
  onTrackLive?: (players: Partial<Player>[]) => void
}

export function LogGamePage({ onSave, onCancel, onDirtyChange, prefillCommander, prefillLiveResult, onTrackLive }: LogGamePageProps) {
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

  // Rich self-commander shortlist (games, win rate, recency) for the one-tap
  // CommanderPicker. Ordered most-recently-played first.
  const myShortlist = useMemo((): CommanderShortlistItem[] => {
    interface Acc {
      games: number
      wins: number
      last: string
      colorIdentity?: MtgColor[]
      manaCost?: string
      imageUri?: string
      typeLine?: string
    }
    const map = new Map<string, Acc>()
    for (const game of games) {
      const me = game.players.find((p) => p.isMe)
      if (!me || !me.commanderName) continue
      const acc = map.get(me.commanderName) ?? { games: 0, wins: 0, last: game.playedAt }
      acc.games += 1
      if (game.winnerId === me.id) acc.wins += 1
      const isLatest = new Date(game.playedAt).getTime() >= new Date(acc.last).getTime()
      if (isLatest || !acc.colorIdentity) {
        if (isLatest) acc.last = game.playedAt
        acc.colorIdentity = me.commanderColorIdentity ?? acc.colorIdentity
        acc.manaCost = me.commanderManaCost ?? acc.manaCost
        acc.imageUri = me.commanderImageUri ?? acc.imageUri
        acc.typeLine = me.commanderTypeLine ?? acc.typeLine
      }
      map.set(me.commanderName, acc)
    }
    return Array.from(map.entries())
      .map(([name, a]) => ({
        name,
        games: a.games,
        winRate: a.games ? a.wins / a.games : 0,
        lastPlayedISO: a.last,
        colorIdentity: a.colorIdentity,
        manaCost: a.manaCost,
        imageUri: a.imageUri,
        typeLine: a.typeLine,
      }))
      .sort((a, b) => new Date(b.lastPlayedISO).getTime() - new Date(a.lastPlayedISO).getTime())
  }, [games])

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

  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [players, setPlayers] = useState<Partial<Player>[]>([])
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null)
  const [podsOpen, setPodsOpen] = useState(false)
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [winTurn, setWinTurn] = useState("")
  const liveResultApplied = useRef(false)
  const [clearedKoTurnPlayerIds, setClearedKoTurnPlayerIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState("")
  const [winConditions, setWinConditions] = useState<string[]>([])
  const [keyWinconCards, setKeyWinconCards] = useState<string[]>([])
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

  // Apply live session result once when the drawer opens pre-populated
  useEffect(() => {
    if (!prefillLiveResult || liveResultApplied.current) return
    liveResultApplied.current = true
    const { players: livePlayers, winTurn: liveWinTurn, winnerId: liveWinnerId } = prefillLiveResult
    setPlayerCount(livePlayers.length)
    setPlayers(livePlayers as Partial<Player>[])
    setWinTurn(String(liveWinTurn))
    if (liveWinnerId) setWinnerId(liveWinnerId)
  }, [prefillLiveResult])

  const formErrorMessage = errors.koTiming
    ? "Winning turn can't be after all opponents are knocked out"
    : "Please fill in all highlighted fields."

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
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
        {pods.length > 0 && (
          <div className="mt-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Or, select an existing pod</label>
            <div className="mt-1">
              <Popover open={podsOpen} onOpenChange={setPodsOpen}>
                <PopoverTrigger asChild>
                  <button className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base justify-between items-center text-left">
                    <span className="truncate text-sm">{selectedPodId ? (pods.find((p) => p.id === selectedPodId)?.label ?? "Select a pod…") : "Select a pod…"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className={isMobile
                    ? "w-[var(--radix-popover-trigger-width)] max-h-[60vh] p-0 z-50 overflow-auto rounded-md"
                    : "w-[var(--radix-popover-trigger-width)] p-0"
                  }
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Filter pods…" />
                    <CommandList>
                      {pods.map((p) => (
                        <CommandItem key={p.id} value={p.id} onSelect={() => {
                          setSelectedPodId(p.id)
                          const pod = p
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
                          setPodsOpen(false)
                        }}>{p.label}</CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
            Add game bracket (Optional)
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Select game bracket
              </h2>
              <a
                href="https://magic.wizards.com/en/formats/commander#brackets"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                About game brackets
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
                    showKoTurnControls={!!winnerId}
                    winTurn={player.id === winnerId ? winTurn : ""}
                    koTurn={getKoTurnValue(player)}
                    onSetWinner={() => { setWinnerId(player.id ?? null); setWinTurn("") }}
                    onWinTurnChange={setWinTurn}
                    onKoTurnChange={(turn) => handleKoTurnChange(originalIndex, turn)}
                    onChange={(updated) => updatePlayer(originalIndex, updated)}
                    recentCommanders={player.isMe ? recentMyCommanders : undefined}
                    myShortlist={player.isMe ? myShortlist : undefined}
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

          {/* Track Game Live */}
          {onTrackLive && (
            <>
              <Separator />
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-dashed"
                  disabled={!playerCount}
                  onClick={() => onTrackLive(players)}
                >
                  <Swords className="h-4 w-4" />
                  Track Game Live
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  (Experimental! Use at your own risk)
                </p>
              </div>
            </>
          )}

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
      </div>

      {hasAnyError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{formErrorMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={players.length === 0}>
            Save Game
          </Button>
        </div>
      </div>
    </div>
  )
}
