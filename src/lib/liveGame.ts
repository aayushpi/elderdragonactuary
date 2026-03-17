import type { Game, LiveGameActionType, LiveGameSession, LiveGameSetup, LiveGameSummary, LiveGameTrackedPlayer, Player } from "@/types"

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getNowIso(now = Date.now()) {
  return new Date(now).toISOString()
}

function orderPlayersFromStartingSeat<T extends { id: string; seatPosition: number }>(players: T[], startingPlayerId: string): T[] {
  const seatOrdered = [...players].sort((a, b) => a.seatPosition - b.seatPosition)
  const startIndex = seatOrdered.findIndex((player) => player.id === startingPlayerId)

  if (startIndex === -1) {
    return seatOrdered
  }

  return [...seatOrdered.slice(startIndex), ...seatOrdered.slice(0, startIndex)]
}

function flushActivePlayerTime(session: LiveGameSession, now = Date.now()): LiveGameSession {
  const elapsed = Math.max(0, now - new Date(session.activePlayerStartedAt).getTime())
  if (elapsed === 0) return session

  return {
    ...session,
    players: session.players.map((player) =>
      player.id === session.activePlayerId
        ? { ...player, elapsedMs: player.elapsedMs + elapsed }
        : player
    ),
    activePlayerStartedAt: getNowIso(now),
    updatedAt: getNowIso(now),
  }
}

function getOrderedPlayers(session: LiveGameSession): LiveGameTrackedPlayer[] {
  return orderPlayersFromStartingSeat(session.players, session.startingPlayerId)
}

function findNextActivePlayerId(session: LiveGameSession): string {
  const orderedPlayers = getOrderedPlayers(session)
  const alivePlayers = orderedPlayers.filter((player) => !player.isEliminated)
  if (alivePlayers.length === 0) {
    return session.activePlayerId
  }

  const currentIndex = alivePlayers.findIndex((player) => player.id === session.activePlayerId)
  if (currentIndex === -1) {
    return alivePlayers[0].id
  }

  return alivePlayers[(currentIndex + 1) % alivePlayers.length].id
}

function shouldAutoEliminate(player: LiveGameTrackedPlayer): boolean {
  if (player.lifeTotal <= 0) return true
  if (player.poisonCounters >= 10) return true
  return Object.values(player.commanderDamageTakenByPlayerId).some((damage) => damage >= 21)
}

function applyAutoElimination(player: LiveGameTrackedPlayer, turnNumber: number): LiveGameTrackedPlayer {
  if (!shouldAutoEliminate(player)) return player
  if (player.isEliminated) return player
  return { ...player, isEliminated: true, eliminatedAtTurn: turnNumber }
}

function shouldAutoRevive(player: LiveGameTrackedPlayer): boolean {
  if (!player.isEliminated) return false
  return !shouldAutoEliminate(player)
}

function applyAutoRevive(player: LiveGameTrackedPlayer): LiveGameTrackedPlayer {
  if (!shouldAutoRevive(player)) return player
  return { ...player, isEliminated: false, eliminatedAtTurn: undefined }
}

function applyAutoStatusUpdate(player: LiveGameTrackedPlayer, turnNumber: number): LiveGameTrackedPlayer {
  if (player.isEliminated) return applyAutoRevive(player)
  return applyAutoElimination(player, turnNumber)
}

export function buildLiveGameSession(setup: LiveGameSetup, now = Date.now()): LiveGameSession {
  const orderedPlayers = orderPlayersFromStartingSeat(setup.players, setup.startingPlayerId)
  const trackedPlayers: LiveGameTrackedPlayer[] = orderedPlayers.map((player) => ({
    ...player,
    lifeTotal: 40,
    poisonCounters: 0,
    commanderDamageTakenByPlayerId: {},
    elapsedMs: 0,
    isEliminated: false,
  }))

  const timestamp = getNowIso(now)

  return {
    id: generateId(),
    stage: "tracking",
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: timestamp,
    activePlayerStartedAt: timestamp,
    turnNumber: 1,
    startingPlayerId: setup.startingPlayerId,
    activePlayerId: setup.startingPlayerId,
    players: trackedPlayers,
    bracket: setup.bracket,
    actions: [],
  }
}

export function changePlayerCounter(
  session: LiveGameSession,
  targetPlayerId: string,
  type: LiveGameActionType,
  delta: number,
  now = Date.now()
): LiveGameSession {
  const flushed = flushActivePlayerTime(session, now)
  let activePlayerEliminatedByUpdate = false

  const updatedPlayers = flushed.players.map((player) => {
    if (player.id !== targetPlayerId) return player

    const updated = type === "life"
      ? { ...player, lifeTotal: player.lifeTotal + delta }
      : { ...player, poisonCounters: Math.max(0, player.poisonCounters + delta) }

    const withAutoElimination = applyAutoStatusUpdate(updated, flushed.turnNumber)
    if (withAutoElimination.id === flushed.activePlayerId && withAutoElimination.isEliminated) {
      activePlayerEliminatedByUpdate = true
    }

    return withAutoElimination
  })

  const withUpdatedPlayers: LiveGameSession = {
    ...flushed,
    players: updatedPlayers,
  }

  const nextActivePlayerId = activePlayerEliminatedByUpdate
    ? findNextActivePlayerId(withUpdatedPlayers)
    : flushed.activePlayerId

  return {
    ...withUpdatedPlayers,
    activePlayerId: nextActivePlayerId,
    activePlayerStartedAt: activePlayerEliminatedByUpdate ? getNowIso(now) : flushed.activePlayerStartedAt,
    actions: [
      ...flushed.actions,
      {
        id: generateId(),
        type,
        turnNumber: flushed.turnNumber,
        actingPlayerId: flushed.activePlayerId,
        targetPlayerId,
        delta,
        createdAt: getNowIso(now),
      },
    ],
    updatedAt: getNowIso(now),
  }
}

export function changeCommanderDamage(
  session: LiveGameSession,
  targetPlayerId: string,
  sourcePlayerId: string,
  delta: number,
  now = Date.now()
): LiveGameSession {
  const flushed = flushActivePlayerTime(session, now)
  let activePlayerEliminatedByUpdate = false

  const updatedPlayers = flushed.players.map((player) => {
    if (player.id !== targetPlayerId) return player

    const current = player.commanderDamageTakenByPlayerId[sourcePlayerId] ?? 0
    const nextValue = Math.max(0, current + delta)
    const nextMap = { ...player.commanderDamageTakenByPlayerId }

    if (nextValue === 0) {
      delete nextMap[sourcePlayerId]
    } else {
      nextMap[sourcePlayerId] = nextValue
    }

    const updated = {
      ...player,
      commanderDamageTakenByPlayerId: nextMap,
      lifeTotal: player.lifeTotal - delta,
    }

    const withAutoElimination = applyAutoStatusUpdate(updated, flushed.turnNumber)
    if (withAutoElimination.id === flushed.activePlayerId && withAutoElimination.isEliminated) {
      activePlayerEliminatedByUpdate = true
    }

    return withAutoElimination
  })

  const withUpdatedPlayers: LiveGameSession = {
    ...flushed,
    players: updatedPlayers,
  }

  const nextActivePlayerId = activePlayerEliminatedByUpdate
    ? findNextActivePlayerId(withUpdatedPlayers)
    : flushed.activePlayerId

  return {
    ...withUpdatedPlayers,
    activePlayerId: nextActivePlayerId,
    activePlayerStartedAt: activePlayerEliminatedByUpdate ? getNowIso(now) : flushed.activePlayerStartedAt,
    actions: [
      ...flushed.actions,
      {
        id: generateId(),
        type: "commander-damage",
        turnNumber: flushed.turnNumber,
        actingPlayerId: flushed.activePlayerId,
        targetPlayerId,
        sourcePlayerId,
        delta,
        createdAt: getNowIso(now),
      },
    ],
    updatedAt: getNowIso(now),
  }
}

export function setPlayerEliminated(session: LiveGameSession, playerId: string, isEliminated: boolean, now = Date.now()): LiveGameSession {
  const flushed = flushActivePlayerTime(session, now)
  const updatedPlayers = flushed.players.map((player) => {
    if (player.id !== playerId) return player
    if (!isEliminated) {
      return { ...player, isEliminated: false, eliminatedAtTurn: undefined }
    }
    return { ...player, isEliminated: true, eliminatedAtTurn: flushed.turnNumber }
  })

  let nextActivePlayerId = flushed.activePlayerId
  if (playerId === flushed.activePlayerId && isEliminated) {
    const withUpdatedPlayers = { ...flushed, players: updatedPlayers }
    nextActivePlayerId = findNextActivePlayerId(withUpdatedPlayers)
  }

  return {
    ...flushed,
    players: updatedPlayers,
    activePlayerId: nextActivePlayerId,
    activePlayerStartedAt: getNowIso(now),
    updatedAt: getNowIso(now),
  }
}

export function advanceLiveGameTurn(session: LiveGameSession, now = Date.now()): LiveGameSession {
  const flushed = flushActivePlayerTime(session, now)
  const orderedPlayers = getOrderedPlayers(flushed).filter((player) => !player.isEliminated)
  if (orderedPlayers.length === 0) return flushed

  const currentIndex = orderedPlayers.findIndex((player) => player.id === flushed.activePlayerId)
  const nextPlayer = orderedPlayers[(currentIndex + 1 + orderedPlayers.length) % orderedPlayers.length]
  const wrappedToStart = nextPlayer.id === flushed.startingPlayerId && nextPlayer.id !== flushed.activePlayerId

  return {
    ...flushed,
    activePlayerId: nextPlayer.id,
    activePlayerStartedAt: getNowIso(now),
    turnNumber: wrappedToStart ? flushed.turnNumber + 1 : flushed.turnNumber,
    updatedAt: getNowIso(now),
  }
}

export function prepareLiveGameForFinalize(session: LiveGameSession, now = Date.now()): LiveGameSession {
  return {
    ...flushActivePlayerTime(session, now),
    stage: "finalize",
    winTurn: session.winTurn ?? session.turnNumber,
    updatedAt: getNowIso(now),
  }
}

export function updateLiveGameFinalization(
  session: LiveGameSession,
  patch: Pick<LiveGameSession, "winnerId" | "winTurn" | "winConditions" | "keyWinconCards" | "notes">,
  now = Date.now()
): LiveGameSession {
  return {
    ...session,
    ...patch,
    updatedAt: getNowIso(now),
  }
}

export function buildGameFromLiveSession(session: LiveGameSession, now = Date.now()): Game {
  const endedAt = getNowIso(now)
  const finalized = flushActivePlayerTime(session, now)
  const winnerId = finalized.winnerId ?? finalized.players[0]?.id ?? ""
  const winTurn = finalized.winTurn ?? finalized.turnNumber

  const players: Player[] = finalized.players.map((player) => ({
    id: player.id,
    isMe: player.isMe,
    commanderName: player.commanderName,
    commanderImageUri: player.commanderImageUri,
    commanderColorIdentity: player.commanderColorIdentity,
    commanderManaCost: player.commanderManaCost,
    commanderTypeLine: player.commanderTypeLine,
    partnerName: player.partnerName,
    partnerImageUri: player.partnerImageUri,
    partnerManaCost: player.partnerManaCost,
    partnerTypeLine: player.partnerTypeLine,
    knockoutTurn: player.id === winnerId ? undefined : player.eliminatedAtTurn ?? winTurn,
    seatPosition: player.seatPosition,
    displayName: player.displayName,
    fastMana: player.fastMana,
    commanderDamageTakenByPlayerId: player.commanderDamageTakenByPlayerId,
  }))

  const playerNames = players.every((player) => player.displayName?.trim())
    ? Object.fromEntries(players.map((player) => [player.id, player.displayName!.trim()]))
    : undefined

  const summary: LiveGameSummary = {
    startedAt: finalized.startedAt,
    endedAt,
    durationMs: Math.max(0, new Date(endedAt).getTime() - new Date(finalized.startedAt).getTime()),
    startingPlayerId: finalized.startingPlayerId,
    playerElapsedMs: Object.fromEntries(finalized.players.map((player) => [player.id, player.elapsedMs])),
    finalLifeTotals: Object.fromEntries(finalized.players.map((player) => [player.id, player.lifeTotal])),
    finalPoisonCounters: Object.fromEntries(finalized.players.map((player) => [player.id, player.poisonCounters])),
    finalCommanderDamageTakenByPlayerId: Object.fromEntries(
      finalized.players.map((player) => [player.id, player.commanderDamageTakenByPlayerId])
    ),
    actions: finalized.actions,
  }

  return {
    id: generateId(),
    playedAt: endedAt,
    players,
    winnerId,
    winTurn,
    notes: finalized.notes?.trim() || undefined,
    winConditions: finalized.winConditions?.length ? finalized.winConditions : undefined,
    keyWinconCards: finalized.keyWinconCards?.length ? finalized.keyWinconCards : undefined,
    bracket: finalized.bracket,
    playerNames,
    startedAt: finalized.startedAt,
    endedAt,
    durationMs: summary.durationMs,
    startingPlayerId: finalized.startingPlayerId,
    liveSummary: summary,
  }
}

export function getLiveGamePlayerElapsedMs(session: LiveGameSession, playerId: string, now = Date.now()): number {
  const player = session.players.find((entry) => entry.id === playerId)
  if (!player) return 0
  if (session.activePlayerId !== playerId) return player.elapsedMs
  return player.elapsedMs + Math.max(0, now - new Date(session.activePlayerStartedAt).getTime())
}

export function getLiveGameDurationMs(session: LiveGameSession, now = Date.now()): number {
  return Math.max(0, now - new Date(session.startedAt).getTime())
}
