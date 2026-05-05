import { useReducer, useRef, useCallback } from "react"
import type { Player } from "@/types"
import type {
  LiveGameState,
  LivePlayer,
  TurnLogEntry,
  DragState,
  DamageSheetState,
} from "@/types/live"

// ─── Helpers ────────────────────────────────────────────────────────────────

function checkElimination(p: LivePlayer): LivePlayer["eliminationCause"] | null {
  if (p.lifeTotal <= 0) return "life"
  if (p.poisonCounters >= 10) return "poison"
  for (const dmg of Object.values(p.commanderDamageReceived)) {
    if (dmg >= 21) return "commanderDamage"
  }
  return null
}

function applyEliminations(players: LivePlayer[], currentTurn: number): LivePlayer[] {
  return players.map((p) => {
    if (p.isEliminated) return p
    const cause = checkElimination(p)
    if (cause) return { ...p, isEliminated: true, eliminatedOnTurn: currentTurn, eliminationCause: cause }
    return p
  })
}

function detectWinner(players: LivePlayer[]): string | null {
  const alive = players.filter((p) => !p.isEliminated)
  return alive.length === 1 ? alive[0].id : null
}

function nextAliveIndex(players: LivePlayer[], from: number): number {
  const n = players.length
  let idx = (from + 1) % n
  for (let i = 0; i < n; i++) {
    if (!players[idx].isEliminated) return idx
    idx = (idx + 1) % n
  }
  return from
}

function commitAllDeltas(players: LivePlayer[]): LivePlayer[] {
  return players.map((p) =>
    p.pendingDelta !== 0 ? { ...p, lifeTotal: Math.max(0, p.lifeTotal + p.pendingDelta), pendingDelta: 0 } : p
  )
}

// ─── Actions ────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADJUST_DELTA"; playerId: string; delta: number }
  | { type: "COMMIT_DELTA"; playerId: string }
  | { type: "APPLY_DAMAGE"; targetId: string; sourceId: string; amount: number; damageType: "regular" | "commander"; lifelink: boolean }
  | { type: "ADJUST_POISON"; playerId: string; delta: number }
  | { type: "END_TURN" }
  | { type: "OPEN_DAMAGE_SHEET"; sourceId: string; targetId: string }
  | { type: "CLOSE_DAMAGE_SHEET" }
  | { type: "UPDATE_DAMAGE_SHEET"; amount?: number; damageType?: "regular" | "commander"; lifelink?: boolean }
  | { type: "START_DRAG"; playerId: string; x: number; y: number }
  | { type: "UPDATE_DRAG"; x: number; y: number; hoveredTargetId: string | null }
  | { type: "CANCEL_DRAG" }

// ─── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: LiveGameState, action: Action): LiveGameState {
  switch (action.type) {
    case "ADJUST_DELTA": {
      const players = state.players.map((p) =>
        p.id === action.playerId ? { ...p, pendingDelta: p.pendingDelta + action.delta } : p
      )
      return { ...state, players }
    }

    case "COMMIT_DELTA": {
      let players = state.players.map((p) => {
        if (p.id !== action.playerId || p.pendingDelta === 0) return p
        return { ...p, lifeTotal: Math.max(0, p.lifeTotal + p.pendingDelta), pendingDelta: 0 }
      })
      players = applyEliminations(players, state.currentTurn)
      const winnerId = detectWinner(players) ?? state.winnerId
      return { ...state, players, winnerId }
    }

    case "APPLY_DAMAGE": {
      let players = state.players.map((p) => {
        if (p.id === action.targetId) {
          const newLife = Math.max(0, p.lifeTotal - action.amount)
          const cmdDmg =
            action.damageType === "commander"
              ? { ...p.commanderDamageReceived, [action.sourceId]: (p.commanderDamageReceived[action.sourceId] ?? 0) + action.amount }
              : p.commanderDamageReceived
          return { ...p, lifeTotal: newLife, commanderDamageReceived: cmdDmg, pendingDelta: 0 }
        }
        if (p.id === action.sourceId && action.lifelink) {
          return { ...p, lifeTotal: p.lifeTotal + action.amount }
        }
        return p
      })
      players = applyEliminations(players, state.currentTurn)
      const winnerId = detectWinner(players) ?? state.winnerId
      return { ...state, players, winnerId, drag: null, damageSheet: null }
    }

    case "ADJUST_POISON": {
      let players = state.players.map((p) => {
        if (p.id !== action.playerId) return p
        return { ...p, poisonCounters: Math.max(0, p.poisonCounters + action.delta) }
      })
      players = applyEliminations(players, state.currentTurn)
      const winnerId = detectWinner(players) ?? state.winnerId
      return { ...state, players, winnerId }
    }

    case "END_TURN": {
      let players = commitAllDeltas(state.players)
      players = applyEliminations(players, state.currentTurn)

      const durationMs = Date.now() - state.turnStartedAt
      const activePlayer = state.players[state.activeSeatIndex]
      const entry: TurnLogEntry = {
        round: state.currentTurn,
        seatPosition: activePlayer.seatPosition,
        playerId: activePlayer.id,
        durationMs,
      }

      const nextIdx = nextAliveIndex(players, state.activeSeatIndex)
      const wrapped = nextIdx <= state.activeSeatIndex
      const newTurn = wrapped ? state.currentTurn + 1 : state.currentTurn
      const winnerId = detectWinner(players) ?? state.winnerId

      return {
        ...state,
        players,
        activeSeatIndex: nextIdx,
        currentTurn: newTurn,
        turnStartedAt: Date.now(),
        turnLog: [...state.turnLog, entry],
        winnerId,
      }
    }

    case "OPEN_DAMAGE_SHEET": {
      const sheet: DamageSheetState = {
        sourcePlayerId: action.sourceId,
        targetPlayerId: action.targetId,
        amount: 1,
        damageType: "regular",
        lifelink: false,
      }
      return { ...state, drag: null, damageSheet: sheet }
    }

    case "CLOSE_DAMAGE_SHEET":
      return { ...state, damageSheet: null }

    case "UPDATE_DAMAGE_SHEET": {
      if (!state.damageSheet) return state
      return {
        ...state,
        damageSheet: {
          ...state.damageSheet,
          amount: action.amount ?? state.damageSheet.amount,
          damageType: action.damageType ?? state.damageSheet.damageType,
          lifelink: action.lifelink ?? state.damageSheet.lifelink,
        },
      }
    }

    case "START_DRAG": {
      const drag: DragState = {
        sourcePlayerId: action.playerId,
        currentX: action.x,
        currentY: action.y,
        hoveredTargetId: null,
      }
      return { ...state, drag }
    }

    case "UPDATE_DRAG": {
      if (!state.drag) return state
      return {
        ...state,
        drag: {
          ...state.drag,
          currentX: action.x,
          currentY: action.y,
          hoveredTargetId: action.hoveredTargetId,
        },
      }
    }

    case "CANCEL_DRAG":
      return { ...state, drag: null }

    default:
      return state
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

export function initLiveGameState(rawPlayers: Partial<Player>[]): LiveGameState {
  const sorted = [...rawPlayers].sort((a, b) => (a.seatPosition ?? 99) - (b.seatPosition ?? 99))
  const players: LivePlayer[] = sorted.map((p, i) => ({
    id: p.id ?? `player-${i}`,
    seatPosition: p.seatPosition ?? ((i + 1) as LivePlayer["seatPosition"]),
    displayName: p.displayName,
    commanderName: p.commanderName ?? "Unknown",
    commanderImageUri: p.commanderImageUri,
    partnerName: p.partnerName,
    partnerImageUri: p.partnerImageUri,
    isMe: p.isMe ?? false,
    lifeTotal: 40,
    commanderDamageReceived: {},
    poisonCounters: 0,
    isEliminated: false,
    pendingDelta: 0,
  }))

  return {
    players,
    startedAt: Date.now(),
    currentTurn: 1,
    activeSeatIndex: 0,
    turnStartedAt: Date.now(),
    turnLog: [],
    drag: null,
    damageSheet: null,
    winnerId: null,
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLiveGame(rawPlayers: Partial<Player>[]) {
  const [state, dispatch] = useReducer(reducer, rawPlayers, initLiveGameState)

  // Per-player commit timers (1.5 s debounce)
  const commitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const adjustDelta = useCallback((playerId: string, delta: number) => {
    if (commitTimers.current[playerId]) clearTimeout(commitTimers.current[playerId])
    dispatch({ type: "ADJUST_DELTA", playerId, delta })
    commitTimers.current[playerId] = setTimeout(() => {
      dispatch({ type: "COMMIT_DELTA", playerId })
      delete commitTimers.current[playerId]
    }, 1500)
  }, [])

  const commitDelta = useCallback((playerId: string) => {
    if (commitTimers.current[playerId]) {
      clearTimeout(commitTimers.current[playerId])
      delete commitTimers.current[playerId]
    }
    dispatch({ type: "COMMIT_DELTA", playerId })
  }, [])

  const applyDamage = useCallback(
    (targetId: string, sourceId: string, amount: number, damageType: "regular" | "commander", lifelink: boolean) => {
      dispatch({ type: "APPLY_DAMAGE", targetId, sourceId, amount, damageType, lifelink })
    },
    []
  )

  const adjustPoison = useCallback((playerId: string, delta: number) => {
    dispatch({ type: "ADJUST_POISON", playerId, delta })
  }, [])

  const endTurn = useCallback(() => {
    // Cancel all pending timers; reducer commits deltas inline
    Object.values(commitTimers.current).forEach(clearTimeout)
    commitTimers.current = {}
    dispatch({ type: "END_TURN" })
  }, [])

  const openDamageSheet = useCallback((sourceId: string, targetId: string) => {
    dispatch({ type: "OPEN_DAMAGE_SHEET", sourceId, targetId })
  }, [])

  const closeDamageSheet = useCallback(() => {
    dispatch({ type: "CLOSE_DAMAGE_SHEET" })
  }, [])

  const updateDamageSheet = useCallback((updates: { amount?: number; damageType?: "regular" | "commander"; lifelink?: boolean }) => {
    dispatch({ type: "UPDATE_DAMAGE_SHEET", ...updates })
  }, [])

  const startDrag = useCallback((playerId: string, x: number, y: number) => {
    dispatch({ type: "START_DRAG", playerId, x, y })
  }, [])

  const updateDrag = useCallback((x: number, y: number, hoveredTargetId: string | null) => {
    dispatch({ type: "UPDATE_DRAG", x, y, hoveredTargetId })
  }, [])

  const cancelDrag = useCallback(() => {
    dispatch({ type: "CANCEL_DRAG" })
  }, [])

  return {
    state,
    adjustDelta,
    commitDelta,
    applyDamage,
    adjustPoison,
    endTurn,
    openDamageSheet,
    closeDamageSheet,
    updateDamageSheet,
    startDrag,
    updateDrag,
    cancelDrag,
  }
}
