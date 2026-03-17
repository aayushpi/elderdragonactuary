import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Clock3, Play, Skull } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PlayerRow } from "@/components/PlayerRow"
import { CardSearch } from "@/components/CardSearch"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import { buildGameFromLiveSession, buildLiveGameSession, changeCommanderDamage, changePlayerCounter, getLiveGameDurationMs, getLiveGamePlayerElapsedMs, prepareLiveGameForFinalize, setPlayerEliminated, advanceLiveGameTurn, updateLiveGameFinalization } from "@/lib/liveGame"
import { clearLiveGameSession, saveLiveGameSession } from "@/lib/liveGameStorage"
import { loadProfile } from "@/lib/storage"
import { cn } from "@/lib/utils"
import type { Game, LiveGameSession, Player, RecentCommander, SeatPosition } from "@/types"

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function makePlayer(isMe: boolean): Partial<Player> {
  return {
    id: generateId(),
    isMe,
    commanderName: "",
    fastMana: { hasFastMana: false, cards: [] },
  }
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, "0")))
    .join(":")
}

interface PlayerFieldErrors {
  commanderName: boolean
  seatPosition: boolean
}

interface SetupErrors {
  playerCount: boolean
  players: PlayerFieldErrors[]
}

function EditableNumber({ value, onCommit, className, disabled }: { value: number; onCommit: (v: number) => void; className?: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (!isEditingRef.current && ref.current) {
      ref.current.textContent = String(value)
    }
  }, [value])

  return (
    <div
      ref={ref}
      contentEditable={!disabled}
      suppressContentEditableWarning
      className={cn(
        "outline-none [caret-color:currentColor]",
        !disabled && "cursor-text",
        disabled && "cursor-default",
        className
      )}
      onFocus={(e) => {
        isEditingRef.current = true
        const range = document.createRange()
        range.selectNodeContents(e.currentTarget)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }}
      onBlur={(e) => {
        isEditingRef.current = false
        const parsed = parseInt(e.currentTarget.textContent ?? "", 10)
        if (!isNaN(parsed)) {
          onCommit(parsed)
        } else if (ref.current) {
          ref.current.textContent = String(value)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (!/[\d\-]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"].includes(e.key)) {
          e.preventDefault()
        }
      }}
    />
  )
}

const EMPTY_SETUP_ERRORS: SetupErrors = {
  playerCount: false,
  players: [],
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
  "Poison or Infect",
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

  for (let seat = totalPlayers; seat >= rightEnd + 1; seat -= 1) {
    leftSeats.push(seat)
  }
  for (let seat = 2; seat <= rightEnd; seat += 1) {
    rightSeats.push(seat)
  }

  const mirrored: number[] = []
  const rows = Math.max(leftSeats.length, rightSeats.length)
  for (let index = 0; index < rows; index += 1) {
    if (leftSeats[index] !== undefined) mirrored.push(leftSeats[index])
    if (rightSeats[index] !== undefined) mirrored.push(rightSeats[index])
  }
  return mirrored
}

interface LiveGamePageProps {
  games: Game[]
  userId: string
  initialSession?: LiveGameSession | null
  prefillCommander?: string
  onSave: (game: Game) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSessionStateChange?: (hasSession: boolean) => void
}

export function LiveGamePage({
  games,
  userId,
  initialSession = null,
  prefillCommander,
  onSave,
  onCancel,
  onDirtyChange,
  onSessionStateChange,
}: LiveGamePageProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [session, setSession] = useState<LiveGameSession | null>(initialSession)

  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [players, setPlayers] = useState<Partial<Player>[]>([])
  const [notes, setNotes] = useState("")
  const [winConditions, setWinConditions] = useState<string[]>([])
  const [keyWinconCards, setKeyWinconCards] = useState<string[]>([])
  const [bracket, setBracket] = useState<number | null>(null)
  const [showBracketSelector, setShowBracketSelector] = useState(false)
  const [errors, setErrors] = useState<SetupErrors>(EMPTY_SETUP_ERRORS)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [copiedPayload, setCopiedPayload] = useState<"session" | "game" | null>(null)
  const [commanderDamageExpandedByTarget, setCommanderDamageExpandedByTarget] = useState<Record<string, boolean>>({})
  const [commanderDamageSourceByTarget, setCommanderDamageSourceByTarget] = useState<Record<string, string>>({})

  // Draggable Next button
  const [nextBtnPos, setNextBtnPos] = useState<{ x: number; y: number } | null>(null)
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)

  function handleNextBtnPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const origin = nextBtnPos ?? getDefaultNextBtnPos()
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: origin.x, originY: origin.y, moved: false }
  }

  function handleNextBtnPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.current.moved = true
    setNextBtnPos({ x: dragState.current.originX + dx, y: dragState.current.originY + dy })
  }

  function handleNextBtnPointerUp(_e: React.PointerEvent<HTMLButtonElement>) {
    const wasMoved = dragState.current?.moved ?? false
    dragState.current = null
    if (!wasMoved) handleAdvanceTurn()
  }

  function getDefaultNextBtnPos() {
    return { x: window.innerWidth / 2 - 32, y: window.innerHeight / 2 - 32 }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateMobileState = () => setIsMobile(mediaQuery.matches)

    updateMobileState()
    mediaQuery.addEventListener("change", updateMobileState)
    return () => mediaQuery.removeEventListener("change", updateMobileState)
  }, [])

  useEffect(() => {
    if (!session) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [session])

  useEffect(() => {
    if (!session) return
    saveLiveGameSession(userId, session)
    onSessionStateChange?.(true)
  }, [onSessionStateChange, session, userId])

  useEffect(() => {
    if (!session) return
    setNotes(session.notes ?? "")
    setWinConditions(session.winConditions ?? [])
    setKeyWinconCards(session.keyWinconCards ?? [])
    setBracket(session.bracket ?? null)
  }, [session])

  const recentMyCommanders = useMemo((): RecentCommander[] => {
    const seen = new Set<string>()
    const result: RecentCommander[] = []
    for (const game of games) {
      const me = game.players.find((player) => player.isMe)
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

  const knownPlayerNames = useMemo((): string[] => {
    const names = new Set<string>()
    for (const game of games) {
      for (const player of game.players) {
        if (!player.isMe && player.displayName?.trim()) {
          names.add(player.displayName.trim())
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [games])

  const pods = useMemo(() => {
    const map = new Map<string, { id: string; opponents: string[]; label: string; totalPlayers: number }>()
    for (const game of games) {
      const names = game.players.map((player) => player.displayName?.trim()).filter(Boolean) as string[]
      if (names.length !== game.players.length || names.length === 0) continue
      const key = [...names].sort((a, b) => a.localeCompare(b)).join("|||")
      if (!map.has(key)) {
        const opponents = game.players
          .filter((player) => !player.isMe)
          .map((player) => player.displayName!.trim())
          .sort((a, b) => a.localeCompare(b))
        map.set(key, { id: key, opponents, label: opponents.join(", "), totalPlayers: game.players.length })
      }
    }
    return Array.from(map.values())
  }, [games])

  const trackerGridColumns = (session?.players.length ?? 0) >= 5 ? 3 : 2
  const trackerGridEntries = useMemo(() => {
    const sessionPlayers = session?.players ?? []
    const remainder = sessionPlayers.length % trackerGridColumns
    if (remainder === 0) return sessionPlayers

    const emptySlots = trackerGridColumns - remainder
    return [...sessionPlayers, ...Array.from({ length: emptySlots }, () => null)]
  }, [session?.players, trackerGridColumns])

  const setupTotalPlayers = playerCount ?? 0
  const setupGridColumns = setupTotalPlayers >= 5 ? 3 : 2
  const setupMirroredSeatIndex = useMemo(() => {
    const mirroredOrder = getMirroredSeatOrder(setupTotalPlayers)
    return new Map(mirroredOrder.map((seat, index) => [seat, index]))
  }, [setupTotalPlayers])

  const sortedSetupPlayerEntries = useMemo(() => {
    if (isMobile) {
      return players.map((player, originalIndex) => ({ player, originalIndex }))
    }

    const seatByPlayerId = new Map<string, number>()
    const assignedSeats = players
      .map((player) => player.seatPosition)
      .filter((seat): seat is SeatPosition => seat !== undefined)
    const assignedSeatSet = new Set(assignedSeats)
    const allPossibleSeats: SeatPosition[] = [1, 2, 3, 4, 5, 6]
    const remainingSeats: SeatPosition[] = []

    for (const seat of allPossibleSeats.slice(0, setupTotalPlayers)) {
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
        const fallbackSeat = remainingSeats[remainingSeatIndex] ?? setupTotalPlayers
        seatByPlayerId.set(playerId, fallbackSeat)
        remainingSeatIndex += 1
      }
    }

    return players
      .map((player, originalIndex) => ({ player, originalIndex }))
      .sort((a, b) => {
        const aSeat = a.player.id ? seatByPlayerId.get(a.player.id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
        const bSeat = b.player.id ? seatByPlayerId.get(b.player.id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
        const aPosition = setupMirroredSeatIndex.get(aSeat) ?? Number.MAX_SAFE_INTEGER
        const bPosition = setupMirroredSeatIndex.get(bSeat) ?? Number.MAX_SAFE_INTEGER
        return aPosition - bPosition || a.originalIndex - b.originalIndex
      })
  }, [isMobile, players, setupMirroredSeatIndex, setupTotalPlayers])

  const setupPlayerGridEntries = useMemo(() => {
    if (isMobile) return sortedSetupPlayerEntries

    const remainder = sortedSetupPlayerEntries.length % setupGridColumns
    if (remainder === 0) return sortedSetupPlayerEntries

    const emptySlots = setupGridColumns - remainder
    const tailStart = sortedSetupPlayerEntries.length - remainder
    return [
      ...sortedSetupPlayerEntries.slice(0, tailStart),
      ...Array.from({ length: emptySlots }, () => null),
      ...sortedSetupPlayerEntries.slice(tailStart),
    ]
  }, [isMobile, setupGridColumns, sortedSetupPlayerEntries])

  const hasSetupDetails = players.some((player) =>
    Boolean(
      player.commanderName?.trim()
      || player.seatPosition
      || player.partnerName?.trim()
      || player.fastMana?.hasFastMana
      || (player.fastMana?.cards?.length ?? 0) > 0
    )
  )

  useEffect(() => {
    if (session) {
      onDirtyChange?.(false)
      return
    }

    const hasDirtySetup =
      playerCount !== null
      || notes.trim().length > 0
      || keyWinconCards.length > 0
      || winConditions.length > 0
      || bracket !== null
      || hasSetupDetails

    onDirtyChange?.(hasDirtySetup)
    return () => onDirtyChange?.(false)
  }, [bracket, hasSetupDetails, keyWinconCards.length, notes, onDirtyChange, playerCount, session, winConditions.length])

  function initPlayers(total: number) {
    const prefill = prefillCommander
    let newPlayers: Partial<Player>[]

    if (players.length === 0) {
      newPlayers = []
      const profile = loadProfile()
      for (let index = 0; index < total; index += 1) {
        const player = makePlayer(index === 0)
        if (index === 0 && prefill) {
          player.commanderName = prefill
        }
        if (index === 0 && profile.displayName) {
          player.displayName = profile.displayName
        }
        newPlayers.push(player)
      }

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
                  commanderColorIdentity: card.color_identity as Player["commanderColorIdentity"],
                }
              }
              return next
            })
          })
          .catch(() => {})
      }
    } else if (total > players.length) {
      newPlayers = [...players]
      for (let index = players.length; index < total; index += 1) {
        newPlayers.push(makePlayer(false))
      }
    } else {
      newPlayers = players.slice(0, total).map((player) => ({
        ...player,
        seatPosition: player.seatPosition !== undefined && player.seatPosition <= total ? player.seatPosition : undefined,
      }))
    }

    setPlayerCount(total)
    setPlayers(newPlayers)
    setErrors(EMPTY_SETUP_ERRORS)
  }

  function updatePlayer(index: number, updated: Partial<Player>) {
    setPlayers((prev) => prev.map((player, playerIndex) => (playerIndex === index ? { ...player, ...updated } : player)))
  }

  function takenSeats(excludeIndex: number): SeatPosition[] {
    return players
      .filter((_, index) => index !== excludeIndex)
      .map((player) => player.seatPosition)
      .filter((seat): seat is SeatPosition => seat !== undefined)
  }

  function applyPod(podId: string) {
    const pod = pods.find((entry) => entry.id === podId)
    if (!pod) return

    const total = pod.totalPlayers
    const profile = loadProfile()
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
    }
    const opponentPlayers: Partial<Player>[] = pod.opponents.map((name, index) => {
      const existing = players[index + 1]
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
      }
    })

    setPlayerCount(total)
    setPlayers([mePlayer, ...opponentPlayers])
  }

  function validateSetup() {
    const seatCounts = new Map<number, number>()
    players.forEach((player) => {
      if (player.seatPosition) {
        seatCounts.set(player.seatPosition, (seatCounts.get(player.seatPosition) ?? 0) + 1)
      }
    })

    const nextErrors: SetupErrors = {
      playerCount: !playerCount,
      players: players.map((player) => ({
        commanderName: !player.commanderName?.trim(),
        seatPosition: !player.seatPosition || (seatCounts.get(player.seatPosition) ?? 0) > 1,
      })),
    }

    const hasError = nextErrors.playerCount || nextErrors.players.some((player) => player.commanderName || player.seatPosition)
    setErrors(hasError ? nextErrors : EMPTY_SETUP_ERRORS)
    return !hasError
  }

  function handleStartTracking() {
    if (!validateSetup()) return
    const finalizedPlayers = players as Player[]
    const turnOrder = [...finalizedPlayers].sort((a, b) => a.seatPosition - b.seatPosition)
    const startingPlayerId = turnOrder[0]?.id
    if (!startingPlayerId) return

    const nextSession = buildLiveGameSession({
      players: finalizedPlayers,
      startingPlayerId,
      bracket: bracket ?? undefined,
    })

    setSession(nextSession)
    setFinalizeError(null)
    onSessionStateChange?.(true)
  }

  function handleAdjustCounter(playerId: string, type: "life" | "poison", delta: number) {
    setSession((prev) => {
      if (!prev) return prev
      return changePlayerCounter(prev, playerId, type, delta)
    })
  }

  function handleAdjustCommanderDamage(targetPlayerId: string, sourcePlayerId: string, delta: number) {
    setSession((prev) => {
      if (!prev) return prev
      return changeCommanderDamage(prev, targetPlayerId, sourcePlayerId, delta)
    })
  }

  function handleAdvanceTurn() {
    setSession((prev) => {
      if (!prev) return prev
      return advanceLiveGameTurn(prev)
    })
  }

  function handleToggleEliminated(playerId: string, isEliminated: boolean) {
    setSession((prev) => {
      if (!prev) return prev
      return setPlayerEliminated(prev, playerId, isEliminated)
    })
  }

  function handleEnterFinalize() {
    setSession((prev) => {
      if (!prev) return prev
      return prepareLiveGameForFinalize(prev)
    })
  }

  function handleFinalizePatch(patch: Partial<Pick<LiveGameSession, "winnerId" | "winTurn" | "notes" | "winConditions" | "keyWinconCards">>) {
    setSession((prev) => {
      if (!prev) return prev
      return updateLiveGameFinalization(prev, {
        winnerId: patch.winnerId ?? prev.winnerId,
        winTurn: patch.winTurn ?? prev.winTurn,
        notes: patch.notes ?? prev.notes,
        winConditions: patch.winConditions ?? prev.winConditions,
        keyWinconCards: patch.keyWinconCards ?? prev.keyWinconCards,
      })
    })
  }

  function handleSaveFinalizedGame() {
    if (!session) return
    if (!session.winnerId) {
      setFinalizeError("Choose a winner before saving.")
      return
    }
    if (!session.winTurn || session.winTurn < 1) {
      setFinalizeError("Enter a valid win turn.")
      return
    }

    const game = buildGameFromLiveSession(session)
    clearLiveGameSession(userId)
    onSessionStateChange?.(false)
    onSave(game)
  }

  function handleReturnToTracking() {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        stage: "tracking",
        updatedAt: new Date().toISOString(),
      }
    })
  }

  function copyPayload(kind: "session" | "game", payload: unknown) {
    void (async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
        setCopiedPayload(kind)
        window.setTimeout(() => {
          setCopiedPayload((prev) => (prev === kind ? null : prev))
        }, 1600)
      } catch {
        setFinalizeError("Could not copy payload. Please copy from the preview text.")
      }
    })()
  }

  const setupErrorMessage = "Please fill in all highlighted setup fields."

  if (!session) {
    return (
      <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <div className="space-y-2">
          <h2 className={cn("text-sm font-semibold uppercase tracking-wide", errors.playerCount ? "text-destructive" : "text-muted-foreground")}>
            How many players?
          </h2>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((count) => (
              <Button
                key={count}
                type="button"
                variant={playerCount === count ? "default" : "outline"}
                className={cn("flex-1", errors.playerCount && playerCount !== count ? "border-destructive" : "")}
                onClick={() => initPlayers(count)}
              >
                {count}
              </Button>
            ))}
          </div>
          {pods.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {pods.map((pod) => (
                <Button key={pod.id} type="button" variant="outline" size="sm" onClick={() => applyPod(pod.id)}>
                  {pod.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {!showBracketSelector ? (
            <Button type="button" variant="outline" onClick={() => setShowBracketSelector(true)} className="w-full">
              Add game bracket (Optional)
            </Button>
          ) : (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((count) => (
                <Button key={count} type="button" variant={bracket === count ? "default" : "outline"} className="flex-1" onClick={() => setBracket(count)}>
                  {count}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            players.length > 0 ? "max-h-[260rem] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
          )}
          aria-hidden={players.length === 0}
        >
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Players</h2>
            <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : setupGridColumns === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {setupPlayerGridEntries.map((entry, gridIndex) => {
                if (!entry) {
                  return <div key={`setup-empty-slot-${gridIndex}`} aria-hidden="true" />
                }

                const { player, originalIndex } = entry
                return (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    isMe={player.isMe ?? false}
                    playerOrder={originalIndex + 1}
                    takenSeats={takenSeats(originalIndex)}
                    totalPlayers={playerCount ?? 0}
                    isWinner={false}
                    showKoTurnControls={false}
                    winTurn=""
                    koTurn=""
                    onSetWinner={() => {}}
                    onWinTurnChange={() => {}}
                    onKoTurnChange={() => {}}
                    onChange={(updated) => updatePlayer(originalIndex, updated)}
                    recentCommanders={player.isMe ? recentMyCommanders : undefined}
                    knownPlayerNames={knownPlayerNames}
                    fieldErrors={errors.players[originalIndex]}
                    showOutcomeControls={false}
                  />
                )
              })}
            </div>
          </div>

        </div>

        {errors.playerCount || errors.players.some((player) => player.commanderName || player.seatPosition) ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{setupErrorMessage}</span>
          </div>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1 gap-2" onClick={handleStartTracking} disabled={players.length === 0}>
            <Play className="h-4 w-4" />
            Start tracking
          </Button>
        </div>
      </div>
    )
  }

  if (session.stage === "finalize") {
    const debugGamePreview = buildGameFromLiveSession(session, now)
    const eventsWithIndex = session.actions.map((action, index) => ({
      eventIndex: index + 1,
      ...action,
    }))
    const elapsedMsByPlayerId = Object.fromEntries(
      session.players.map((player) => [player.id, getLiveGamePlayerElapsedMs(session, player.id, now)])
    )
    const alivePlayerIds = session.players.filter((player) => !player.isEliminated).map((player) => player.id)
    const outPlayerIds = session.players.filter((player) => player.isEliminated).map((player) => player.id)
    const debugSessionPreview = {
      meta: {
        createdAt: session.startedAt,
        lastUpdatedAt: session.updatedAt,
        actionCount: session.actions.length,
      },
      sessionState: {
        turnNumber: session.turnNumber,
        activePlayerId: session.activePlayerId,
        startedAt: session.startedAt,
        durationMs: getLiveGameDurationMs(session, now),
      },
      playersById: Object.fromEntries(
        session.players.map((player) => [player.id, { name: player.displayName?.trim() || player.commanderName }])
      ),
      countersSnapshot: {
        lifeByPlayerId: Object.fromEntries(session.players.map((player) => [player.id, player.lifeTotal])),
        poisonByPlayerId: Object.fromEntries(session.players.map((player) => [player.id, player.poisonCounters])),
        commanderDamageTakenByTarget: Object.fromEntries(
          session.players.map((player) => [player.id, player.commanderDamageTakenByPlayerId])
        ),
        elapsedMsByPlayerId,
        eliminationByPlayerId: Object.fromEntries(
          session.players.map((player) => [
            player.id,
            player.isEliminated ? { turn: player.eliminatedAtTurn ?? session.turnNumber } : null,
          ])
        ),
      },
      events: eventsWithIndex,
      derivedSummary: {
        alivePlayerIds,
        outPlayerIds,
        elapsedMsTotal: Object.values(elapsedMsByPlayerId).reduce((sum, value) => sum + value, 0),
      },
    }

    return (
      <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <div className="space-y-2">
          <Badge variant="secondary" className="w-fit">Turn {session.turnNumber}</Badge>
          <h2 className="text-lg font-semibold">Finish the live game</h2>
          <p className="text-sm text-muted-foreground">Pick the winner, confirm the win turn, and add the normal win details before saving.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Winner</label>
          <div className="flex flex-wrap gap-2">
            {session.players.map((player) => (
              <Button
                key={player.id}
                type="button"
                variant={session.winnerId === player.id ? "default" : "outline"}
                onClick={() => {
                  setFinalizeError(null)
                  handleFinalizePatch({ winnerId: player.id })
                }}
              >
                {player.displayName?.trim() || player.commanderName}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Win turn</label>
          <Input
            type="number"
            min={1}
            value={session.winTurn ?? session.turnNumber}
            onChange={(event) => {
              setFinalizeError(null)
              handleFinalizePatch({ winTurn: Number.parseInt(event.target.value || "0", 10) || 0 })
            }}
          />
        </div>

        <Separator />
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Key wincon cards (Optional)</label>
          </div>
          <CardSearch
            selectedCards={keyWinconCards}
            onAddCard={(cardName) => {
              const next = [...keyWinconCards, cardName]
              setKeyWinconCards(next)
              handleFinalizePatch({ keyWinconCards: next })
            }}
            onRemoveCard={(cardName) => {
              const next = keyWinconCards.filter((card) => card !== cardName)
              setKeyWinconCards(next)
              handleFinalizePatch({ keyWinconCards: next })
            }}
            placeholder="Search for key wincon cards…"
          />
        </div>

        <Separator />
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">How did they win (Optional)</label>
          </div>
          <div className="flex flex-wrap gap-2">
            {WIN_CONDITION_CATEGORIES.map((condition) => (
              <button
                key={condition}
                type="button"
                onClick={() => {
                  const next = winConditions.includes(condition)
                    ? winConditions.filter((entry) => entry !== condition)
                    : [...winConditions, condition]
                  setWinConditions(next)
                  handleFinalizePatch({ winConditions: next })
                }}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs transition-colors whitespace-nowrap",
                  winConditions.includes(condition)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {condition}
              </button>
            ))}
          </div>
        </div>

        <Separator />
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Debug JSON preview</label>
          <details className="rounded-md border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium">Preview live session payload</summary>
            <div className="mt-2 flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => copyPayload("session", debugSessionPreview)}>
                {copiedPayload === "session" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-xs">{JSON.stringify(debugSessionPreview, null, 2)}</pre>
          </details>
          <details className="rounded-md border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium">Preview final saved game payload</summary>
            <div className="mt-2 flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => copyPayload("game", debugGamePreview)}>
                {copiedPayload === "game" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-xs">{JSON.stringify(debugGamePreview, null, 2)}</pre>
          </details>
        </div>

        <Separator />
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="live-notes">
            Notes (Optional)
          </label>
          <Textarea
            id="live-notes"
            rows={3}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value)
              handleFinalizePatch({ notes: event.target.value })
            }}
            placeholder="Any additional notes…"
          />
        </div>

        {finalizeError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{finalizeError}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleReturnToTracking}>
            Back to tracker
          </Button>
          <Button className="flex-1" onClick={handleSaveFinalizedGame}>
            Save game
          </Button>
        </div>
      </div>
    )
  }

  const totalDuration = getLiveGameDurationMs(session, now)
  const activePlayer = session.players.find((player) => player.id === session.activePlayerId)

  return (
    <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
      <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            <span>{formatDuration(totalDuration)}</span>
          </div>
          <Badge className="text-sm">Turn {session.turnNumber}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Active player: <span className="font-medium text-foreground">{activePlayer?.displayName?.trim() || activePlayer?.commanderName}</span>
        </p>
      </div>

      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : trackerGridColumns === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {trackerGridEntries.map((player, gridIndex) => {
          if (!player) {
            return <div key={`empty-slot-${gridIndex}`} aria-hidden="true" />
          }

          const isActive = player.id === session.activePlayerId
          const elapsedMs = getLiveGamePlayerElapsedMs(session, player.id, now)
          const isWinnerSelected = session.winnerId === player.id
          const canReturnThisTurn = player.isEliminated && player.eliminatedAtTurn === session.turnNumber
          return (
            <Card key={player.id} className={cn("relative overflow-hidden", isActive ? "border-primary shadow-md" : "border-border", player.isEliminated ? "opacity-75" : "") }>
              {player.commanderImageUri && (
                <>
                  <img
                    src={player.commanderImageUri}
                    alt={`${player.commanderName} art`}
                    className="absolute inset-0 h-full w-full object-cover opacity-20"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background/95" />
                </>
              )}
              <CardContent className="relative z-10 space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{player.displayName?.trim() || player.commanderName}</h3>
                      {isActive && <Badge variant="secondary">Active</Badge>}
                      {isWinnerSelected && <Badge>Winner</Badge>}
                      {player.isEliminated && <Badge variant="destructive">Out</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">Seat {player.seatPosition} · {player.commanderName}{player.partnerName ? ` // ${player.partnerName}` : ""}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>Clock</div>
                    <div className="font-medium text-foreground">{formatDuration(elapsedMs)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Life</div>
                    <div className="flex items-center justify-between gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={player.isEliminated} onClick={() => handleAdjustCounter(player.id, "life", -1)}>-</Button>
                      <EditableNumber
                        value={player.lifeTotal}
                        disabled={player.isEliminated}
                        className="text-3xl font-semibold tabular-nums"
                        onCommit={(v) => handleAdjustCounter(player.id, "life", v - player.lifeTotal)}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => handleAdjustCounter(player.id, "life", 1)}>+</Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {player.poisonCounters === 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={player.isEliminated}
                      onClick={() => handleAdjustCounter(player.id, "poison", 1)}
                    >
                      Add Poison
                    </Button>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-md border px-2 py-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Poison</span>
                      <EditableNumber
                        value={player.poisonCounters}
                        disabled={player.isEliminated}
                        className="text-sm font-semibold tabular-nums"
                        onCommit={(v) => handleAdjustCounter(player.id, "poison", v - player.poisonCounters)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        onClick={() => handleAdjustCounter(player.id, "poison", -1)}
                      >
                        -
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={player.isEliminated}
                        onClick={() => handleAdjustCounter(player.id, "poison", 1)}
                      >
                        +
                      </Button>
                    </div>
                  )}
                  {(() => {
                    const allSources = session.players.filter((candidate) => candidate.id !== player.id)
                    const pickerOpen = commanderDamageExpandedByTarget[player.id] ?? false
                    const pickerSource = commanderDamageSourceByTarget[player.id] ?? allSources[0]?.id ?? ""
                    const existingEntries = Object.entries(player.commanderDamageTakenByPlayerId ?? {})

                    return (
                      <>
                        {existingEntries.map(([sourceId, value]) => {
                          const sourcePlayer = session.players.find((p) => p.id === sourceId)
                          const sourceName = sourcePlayer?.displayName?.trim() || sourcePlayer?.commanderName || sourceId
                          return (
                            <div key={sourceId} className="inline-flex items-center gap-2 rounded-md border px-2 py-1">
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">Cmdr · {sourceName}</span>
                              <EditableNumber
                                value={value}
                                disabled={player.isEliminated}
                                className="text-sm font-semibold tabular-nums"
                                onCommit={(v) => handleAdjustCommanderDamage(player.id, sourceId, v - value)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                onClick={() => handleAdjustCommanderDamage(player.id, sourceId, -1)}
                              >
                                -
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={player.isEliminated}
                                onClick={() => handleAdjustCommanderDamage(player.id, sourceId, 1)}
                              >
                                +
                              </Button>
                            </div>
                          )
                        })}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={player.isEliminated}
                          onClick={() => setCommanderDamageExpandedByTarget((prev) => ({ ...prev, [player.id]: !prev[player.id] }))}
                        >
                          Add commander damage
                        </Button>
                        {pickerOpen && !player.isEliminated && (
                          <div className="inline-flex items-center gap-2 rounded-md border px-2 py-1">
                            <select
                              value={pickerSource}
                              onChange={(event) => {
                                setCommanderDamageSourceByTarget((prev) => ({ ...prev, [player.id]: event.target.value }))
                              }}
                              className="h-7 rounded border bg-background px-2 text-xs"
                            >
                              {allSources.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.displayName?.trim() || candidate.commanderName}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              disabled={!pickerSource}
                              onClick={() => {
                                if (!pickerSource) return
                                handleAdjustCommanderDamage(player.id, pickerSource, 1)
                              }}
                            >
                              +
                            </Button>
                          </div>
                        )}
                      </>
                    )
                  })()}
                  <Button
                    type="button"
                    size="sm"
                    variant={player.isEliminated ? "outline" : "secondary"}
                    className="gap-2"
                    disabled={player.isEliminated && !canReturnThisTurn}
                    onClick={() => handleToggleEliminated(player.id, !player.isEliminated)}
                  >
                    <Skull className="h-4 w-4" />
                    {player.isEliminated ? (canReturnThisTurn ? "Back in game" : "Out") : "Mark out"}
                  </Button>
                  {player.eliminatedAtTurn && <Badge variant="outline">Out on turn {player.eliminatedAtTurn}</Badge>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button variant="outline" className="flex-1" onClick={handleEnterFinalize}>
            End game
          </Button>
        </div>
      </div>

      {/* Draggable floating Next button */}
      {(() => {
        const pos = nextBtnPos ?? getDefaultNextBtnPos()
        return (
          <button
            type="button"
            style={{ position: "fixed", left: pos.x, top: pos.y, touchAction: "none", zIndex: 50 }}
            onPointerDown={handleNextBtnPointerDown}
            onPointerMove={handleNextBtnPointerMove}
            onPointerUp={handleNextBtnPointerUp}
            className="flex h-16 w-16 select-none items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-xl ring-2 ring-background active:scale-95"
          >
            Next
          </button>
        )
      })()}
    </div>
  )
}
