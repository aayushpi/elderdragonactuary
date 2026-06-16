import { useCallback, useEffect, useMemo, useState } from "react"
import type { Game, MtgColor, Player, SeatPosition } from "@/types"

/* ============================================================================
 * Live-game engine — shared by every prototype board variant.
 *
 * Owns: life totals, the turn clock, the directional damage ledger (with
 * commander damage + lifelink), knockout / revive, undo, and end-game → save →
 * rematch. Boards differ only in how the table *enters* damage; the rules below
 * stay identical so variants are comparable on UX, not behaviour.
 *
 * Knockout is *derived* (life ≤ 0, or ≥21 from one commander, or a manual KO),
 * never a sticky flag — that's what lets undo reverse a lethal hit cleanly.
 * ==========================================================================*/

export const STARTING_LIFE = 40
export const LETHAL_COMMANDER = 21
export const LETHAL_POISON = 10

export function genId(): string {
  return Math.random().toString(36) + Date.now().toString(36)
}

export interface LivePlayer {
  id: string
  seatPosition: SeatPosition
  isMe: boolean
  displayName: string
  commanderName: string
  commanderImageUri?: string
  commanderColorIdentity?: MtgColor[]
  commanderManaCost?: string
  commanderTypeLine?: string
}

/** One entry in the damage ledger. `sourceId === null` = an undirected change
 *  (paid life, fetch, table-wide effect, manual correction). A positive amount
 *  is damage; negative is a life adjustment. `lifelink` grants the source that
 *  much life. */
export interface DamageEvent {
  kind: "damage"
  id: string
  turn: number
  sourceId: string | null
  targetId: string
  amount: number
  isCommander: boolean
  isLifelink: boolean
  isPoison: boolean
  ts: number
}

/** Recorded when a turn ends so undo can restore turn number + active seat. */
export interface TurnEvent {
  kind: "turn"
  id: string
  /** turn number that just ended */
  turn: number
  fromSeat: SeatPosition
  toSeat: SeatPosition
  ts: number
}

export type GameEvent = DamageEvent | TurnEvent

export interface LiveConfig {
  players: LivePlayer[]
  startingSeat: SeatPosition
  podId?: string
  podLabel?: string
}

export interface PlayerRuntime {
  life: number
  /** commander damage taken, keyed by source player id */
  commanderFrom: Record<string, number>
  /** poison counters (10 = lethal) */
  poison: number
  manualKO: boolean
  /** true once life ≤ 0, a commander source ≥ 21, or poison ≥ 10 */
  lethal: boolean
  /** lethal || manualKO */
  knockedOut: boolean
  knockoutTurn?: number
}

export interface DamageOpts {
  sourceId?: string | null
  isCommander?: boolean
  isLifelink?: boolean
  isPoison?: boolean
}

export type Phase = "playing" | "ended"

export interface LiveGameApi {
  config: LiveConfig
  players: LivePlayer[]
  runtime: Record<string, PlayerRuntime>
  events: GameEvent[]
  phase: Phase
  turn: number
  activeSeat: SeatPosition
  activePlayer: LivePlayer
  turnStartedAt: number
  /** false until the first turn is started (explicit Start) — gates the clock */
  started: boolean
  aliveCount: number
  canEnd: boolean
  canUndo: boolean
  winnerId: string | null
  /** apply a life change; positive amount = damage dealt to target */
  applyDamage: (targetId: string, amount: number, opts?: DamageOpts) => void
  undoLast: () => void
  /** revert all events at or after the given index */
  undoToIndex: (index: number) => void
  /** set who goes first, before the clock starts (high roll / manual pick) */
  chooseStarter: (seat: SeatPosition) => void
  /** begin the first turn (start the clock) */
  start: () => void
  endTurn: () => void
  toggleKnockout: (id: string) => void
  revive: (id: string) => void
  endGame: () => void
  buildGame: () => Game
  reset: (cfg?: LiveConfig) => void
  /** assign / change a seat's commander mid-flow (deferred "add later") */
  setCommander: (id: string, c: CommanderAssign) => void
  setDisplayName: (id: string, name: string) => void
  /** swap two players' seat positions before the game starts */
  swapSeats: (aId: string, bId: string) => void
}

export interface CommanderAssign {
  commanderName: string
  commanderImageUri?: string
  commanderColorIdentity?: MtgColor[]
  commanderManaCost?: string
  commanderTypeLine?: string
}

interface Core {
  life: Record<string, number>
  cmdr: Record<string, Record<string, number>>
  poison: Record<string, number>
  manualKO: Record<string, boolean>
  koTurn: Record<string, number>
}

function freshCore(players: LivePlayer[]): Core {
  const life: Record<string, number> = {}
  const cmdr: Record<string, Record<string, number>> = {}
  const poison: Record<string, number> = {}
  const manualKO: Record<string, boolean> = {}
  for (const p of players) {
    life[p.id] = STARTING_LIFE
    cmdr[p.id] = {}
    poison[p.id] = 0
    manualKO[p.id] = false
  }
  return { life, cmdr, poison, manualKO, koTurn: {} }
}

function deriveRuntime(core: Core, players: LivePlayer[]): Record<string, PlayerRuntime> {
  const out: Record<string, PlayerRuntime> = {}
  for (const p of players) {
    const life = core.life[p.id] ?? STARTING_LIFE
    const commanderFrom = core.cmdr[p.id] ?? {}
    const poison = core.poison[p.id] ?? 0
    const lethal =
      life <= 0 || poison >= LETHAL_POISON || Object.values(commanderFrom).some((v) => v >= LETHAL_COMMANDER)
    const knockedOut = lethal || !!core.manualKO[p.id]
    out[p.id] = {
      life,
      commanderFrom,
      poison,
      manualKO: !!core.manualKO[p.id],
      lethal,
      knockedOut,
      knockoutTurn: core.koTurn[p.id],
    }
  }
  return out
}

function isOut(core: Core, id: string): boolean {
  const life = core.life[id] ?? STARTING_LIFE
  const cmdr = core.cmdr[id] ?? {}
  const poison = core.poison[id] ?? 0
  const lethal = life <= 0 || poison >= LETHAL_POISON || Object.values(cmdr).some((v) => v >= LETHAL_COMMANDER)
  return lethal || !!core.manualKO[id]
}

/** Recompute koTurn for every player given the current core: stamp the turn a
 *  player first goes out, clear it when they're back in. */
function syncKoTurns(core: Core, players: LivePlayer[], turn: number): Record<string, number> {
  const next = { ...core.koTurn }
  for (const p of players) {
    if (isOut(core, p.id)) {
      if (next[p.id] == null) next[p.id] = turn
    } else {
      delete next[p.id]
    }
  }
  return next
}

export function useLiveGame(initial: LiveConfig): LiveGameApi {
  const [config, setConfig] = useState<LiveConfig>(initial)
  const [core, setCore] = useState<Core>(() => freshCore(initial.players))
  const [events, setEvents] = useState<GameEvent[]>([])
  const [phase, setPhase] = useState<Phase>("playing")
  const [turn, setTurn] = useState(1)
  const [activeSeat, setActiveSeat] = useState<SeatPosition>(initial.startingSeat)
  const [turnStartedAt, setTurnStartedAt] = useState(() => Date.now())
  const [started, setStarted] = useState(false)

  const players = config.players
  const seatOrder = useMemo(
    () => [...players].sort((a, b) => a.seatPosition - b.seatPosition),
    [players]
  )
  const runtime = useMemo(() => deriveRuntime(core, players), [core, players])

  const applyDamage = useCallback(
    (targetId: string, amount: number, opts?: DamageOpts) => {
      if (amount === 0) return
      const sourceId = opts?.sourceId ?? null
      const isCommander = opts?.isCommander ?? false
      const isLifelink = opts?.isLifelink ?? false
      const isPoison = opts?.isPoison ?? false
      setEvents((prev) => [
        ...prev,
        { kind: "damage", id: genId(), turn, sourceId, targetId, amount, isCommander, isLifelink, isPoison, ts: Date.now() },
      ])
      setCore((prev) => {
        const life = { ...prev.life }
        const cmdr = { ...prev.cmdr, [targetId]: { ...prev.cmdr[targetId] } }
        const poison = { ...prev.poison }
        if (isPoison) {
          poison[targetId] = Math.max(0, (poison[targetId] ?? 0) + amount)
          life[targetId] = (life[targetId] ?? STARTING_LIFE) - amount
        } else {
          life[targetId] = (life[targetId] ?? STARTING_LIFE) - amount
          if (isCommander && sourceId) {
            cmdr[targetId][sourceId] = Math.max(0, (cmdr[targetId][sourceId] ?? 0) + amount)
          }
          if (isLifelink && sourceId && amount > 0) {
            life[sourceId] = (life[sourceId] ?? STARTING_LIFE) + amount
          }
        }
        const draft: Core = { ...prev, life, cmdr, poison }
        return { ...draft, koTurn: syncKoTurns(draft, players, turn) }
      })
    },
    [turn, players]
  )

  const undoLast = useCallback(() => {
    const last = events[events.length - 1]
    if (!last) return
    setEvents((prev) => prev.slice(0, -1))
    if (last.kind === "turn") {
      // reverse the turn transition
      setTurn(last.turn)
      setActiveSeat(last.fromSeat)
      setTurnStartedAt(Date.now())
      return
    }
    setCore((c) => {
      const life = { ...c.life }
      const cmdr = { ...c.cmdr, [last.targetId]: { ...c.cmdr[last.targetId] } }
      const poison = { ...c.poison }
      if (last.isPoison) {
        poison[last.targetId] = Math.max(0, (poison[last.targetId] ?? 0) - last.amount)
        life[last.targetId] = (life[last.targetId] ?? STARTING_LIFE) + last.amount
      } else {
        life[last.targetId] = (life[last.targetId] ?? STARTING_LIFE) + last.amount
        if (last.isCommander && last.sourceId) {
          cmdr[last.targetId][last.sourceId] = Math.max(0, (cmdr[last.targetId][last.sourceId] ?? 0) - last.amount)
        }
        if (last.isLifelink && last.sourceId && last.amount > 0) {
          life[last.sourceId] = (life[last.sourceId] ?? STARTING_LIFE) - last.amount
        }
      }
      const draft: Core = { ...c, life, cmdr, poison }
      return { ...draft, koTurn: syncKoTurns(draft, players, turn) }
    })
  }, [events, players, turn])

  const undoToIndex = useCallback((index: number) => {
    const kept = events.slice(0, index)
    let c = freshCore(players)
    let replayedTurn = 1
    let replayedSeat: SeatPosition = config.startingSeat
    for (const ev of kept) {
      if (ev.kind === "turn") {
        replayedTurn = ev.turn + 1
        replayedSeat = ev.toSeat
        continue
      }
      const life = { ...c.life }
      const cmdr = { ...c.cmdr, [ev.targetId]: { ...c.cmdr[ev.targetId] } }
      const poison = { ...c.poison }
      if (ev.isPoison) {
        poison[ev.targetId] = Math.max(0, (poison[ev.targetId] ?? 0) + ev.amount)
        life[ev.targetId] = (life[ev.targetId] ?? STARTING_LIFE) - ev.amount
      } else {
        life[ev.targetId] = (life[ev.targetId] ?? STARTING_LIFE) - ev.amount
        if (ev.isCommander && ev.sourceId) {
          cmdr[ev.targetId][ev.sourceId] = Math.max(0, (cmdr[ev.targetId][ev.sourceId] ?? 0) + ev.amount)
        }
        if (ev.isLifelink && ev.sourceId && ev.amount > 0) {
          life[ev.sourceId] = (life[ev.sourceId] ?? STARTING_LIFE) + ev.amount
        }
      }
      c = { ...c, life, cmdr, poison }
    }
    setEvents(kept)
    setCore({ ...c, koTurn: syncKoTurns(c, players, replayedTurn) })
    setTurn(replayedTurn)
    setActiveSeat(replayedSeat)
    setPhase("playing")
  }, [events, players, config.startingSeat])

  const chooseStarter = useCallback((seat: SeatPosition) => setActiveSeat(seat), [])

  const start = useCallback(() => {
    setStarted(true)
    setTurnStartedAt(Date.now())
  }, [])

  const endTurn = useCallback(() => {
    const order = seatOrder
    const idx = order.findIndex((p) => p.seatPosition === activeSeat)
    let nextSeat = activeSeat
    for (let step = 1; step <= order.length; step++) {
      const cand = order[(idx + step) % order.length]
      if (!runtime[cand.id]?.knockedOut) {
        nextSeat = cand.seatPosition
        break
      }
    }
    setEvents((prev) => [
      ...prev,
      { kind: "turn", id: genId(), turn, fromSeat: activeSeat, toSeat: nextSeat, ts: Date.now() },
    ])
    setActiveSeat(nextSeat)
    setTurn((t) => t + 1)
    setTurnStartedAt(Date.now())
  }, [seatOrder, runtime, activeSeat, turn])

  const toggleKnockout = useCallback(
    (id: string) => {
      setCore((prev) => {
        const manualKO = { ...prev.manualKO, [id]: !prev.manualKO[id] }
        const draft: Core = { ...prev, manualKO }
        return { ...draft, koTurn: syncKoTurns(draft, players, turn) }
      })
    },
    [players, turn]
  )

  const revive = useCallback((id: string) => {
    setCore((prev) => {
      const koTurn = { ...prev.koTurn }
      delete koTurn[id]
      return {
        life: { ...prev.life, [id]: STARTING_LIFE },
        cmdr: { ...prev.cmdr, [id]: {} },
        poison: { ...prev.poison, [id]: 0 },
        manualKO: { ...prev.manualKO, [id]: false },
        koTurn,
      }
    })
    setEvents((prev) => prev.filter((e) => e.kind !== "damage" || e.targetId !== id))
  }, [])

  const aliveCount = useMemo(
    () => players.filter((p) => !runtime[p.id]?.knockedOut).length,
    [players, runtime]
  )
  const canEnd = aliveCount <= 1

  const winnerId = useMemo(() => {
    const alive = players.filter((p) => !runtime[p.id]?.knockedOut)
    if (alive.length === 1) return alive[0].id
    if (alive.length === 0) {
      const sorted = [...players].sort(
        (a, b) => (runtime[b.id]?.knockoutTurn ?? 0) - (runtime[a.id]?.knockoutTurn ?? 0)
      )
      return sorted[0]?.id ?? null
    }
    return null
  }, [players, runtime])

  const setCommander = useCallback((id: string, c: CommanderAssign) => {
    setConfig((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === id
          ? {
              ...p,
              commanderName: c.commanderName,
              commanderImageUri: c.commanderImageUri,
              commanderColorIdentity: c.commanderColorIdentity,
              commanderManaCost: c.commanderManaCost,
              commanderTypeLine: c.commanderTypeLine,
            }
          : p
      ),
    }))
  }, [])

  const setDisplayName = useCallback((id: string, name: string) => {
    setConfig((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === id ? { ...p, displayName: name } : p)),
    }))
  }, [])

  const swapSeats = useCallback((aId: string, bId: string) => {
    setConfig((prev) => {
      const ps = [...prev.players]
      const ai = ps.findIndex((p) => p.id === aId)
      const bi = ps.findIndex((p) => p.id === bId)
      if (ai === -1 || bi === -1) return prev
      const aSeat = ps[ai].seatPosition
      ps[ai] = { ...ps[ai], seatPosition: ps[bi].seatPosition }
      ps[bi] = { ...ps[bi], seatPosition: aSeat }
      return { ...prev, players: ps }
    })
  }, [])

  const endGame = useCallback(() => setPhase("ended"), [])

  const reset = useCallback(
    (cfg?: LiveConfig) => {
      const next = cfg ?? config
      setConfig(next)
      setCore(freshCore(next.players))
      setEvents([])
      setPhase("playing")
      setTurn(1)
      setActiveSeat(next.startingSeat)
      setTurnStartedAt(Date.now())
      setStarted(false)
    },
    [config]
  )

  const buildGame = useCallback((): Game => {
    const gamePlayers: Player[] = players.map((p) => ({
      id: p.id,
      isMe: p.isMe,
      commanderName: p.commanderName,
      commanderImageUri: p.commanderImageUri,
      commanderColorIdentity: p.commanderColorIdentity,
      commanderManaCost: p.commanderManaCost,
      commanderTypeLine: p.commanderTypeLine,
      seatPosition: p.seatPosition,
      displayName: p.displayName,
      knockoutTurn: runtime[p.id]?.knockoutTurn,
      fastMana: { hasFastMana: false, cards: [] },
    }))
    const names: Record<string, string> = {}
    for (const p of players) names[p.id] = p.displayName
    return {
      id: genId(),
      playedAt: new Date().toISOString(),
      players: gamePlayers,
      winnerId: winnerId ?? players[0].id,
      winTurn: turn,
      podId: config.podId,
      playerNames: names,
    }
  }, [players, runtime, winnerId, turn, config.podId])

  const activePlayer = useMemo(
    () => seatOrder.find((p) => p.seatPosition === activeSeat) ?? seatOrder[0],
    [seatOrder, activeSeat]
  )

  return {
    config,
    players,
    runtime,
    events,
    phase,
    turn,
    activeSeat,
    activePlayer,
    turnStartedAt,
    started,
    aliveCount,
    canEnd,
    canUndo: events.length > 0,
    winnerId,
    applyDamage,
    undoLast,
    undoToIndex,
    chooseStarter,
    start,
    endTurn,
    toggleKnockout,
    revive,
    endGame,
    buildGame,
    reset,
    setCommander,
    setDisplayName,
    swapSeats,
  }
}

/* ============================================================================
 * Ring seat layout — the device lies flat at the centre of the table and seats
 * sit around the rim in clockwise order, each rotated to face the player
 * sitting on that side. Positions are polar (screen coordinates), so the math
 * is independent of how the cards are styled.
 *
 * Seat 0 sits at the bottom (nearest, upright); we walk clockwise from there.
 * ==========================================================================*/

export interface RingCellSpec {
  /** grid-area name this seat occupies */
  area: string
  /** degrees to rotate the panel so it faces the player on that edge */
  rotate: number
}

export interface RingGrid {
  columns: string
  rows: string
  /** grid-template-areas rows */
  areas: string[]
  /** seats in clockwise order (index-aligned to seatPosition ascending) */
  cells: RingCellSpec[]
}

/** Edge-to-edge tilings authored clockwise from the bottom seat. Each seat fills
 *  a grid cell and is rotated to face the table edge it sits on (bottom 0°,
 *  left 90°, top 180°, right 270°) — so the panels read like players seated
 *  clockwise around the device. The hub floats over the centre. */
const RING_GRIDS: Record<number, RingGrid> = {
  2: {
    columns: "1fr",
    rows: "1fr 1fr",
    areas: ['"top"', '"bot"'],
    cells: [{ area: "bot", rotate: 0 }, { area: "top", rotate: 180 }],
  },
  3: {
    columns: "1fr 1fr",
    rows: "1fr 1fr",
    areas: ['"tl tr"', '"bot bot"'],
    cells: [
      { area: "bot", rotate: 0 },
      { area: "tl", rotate: 180 },
      { area: "tr", rotate: 180 },
    ],
  },
  4: {
    columns: "1fr 1fr",
    rows: "1fr 1.25fr 1fr",
    areas: ['"top top"', '"lft rgt"', '"bot bot"'],
    cells: [
      { area: "bot", rotate: 0 },
      { area: "lft", rotate: 90 },
      { area: "top", rotate: 180 },
      { area: "rgt", rotate: 270 },
    ],
  },
  5: {
    columns: "1fr 1fr",
    rows: "1fr 1.25fr 1fr",
    areas: ['"top top"', '"lft rgt"', '"bl br"'],
    cells: [
      { area: "bl", rotate: 0 },
      { area: "lft", rotate: 90 },
      { area: "top", rotate: 180 },
      { area: "rgt", rotate: 270 },
      { area: "br", rotate: 0 },
    ],
  },
  6: {
    columns: "1fr 1fr",
    rows: "1fr 1.25fr 1fr",
    areas: ['"tl tr"', '"lft rgt"', '"bl br"'],
    cells: [
      { area: "bl", rotate: 0 },
      { area: "lft", rotate: 90 },
      { area: "tl", rotate: 180 },
      { area: "tr", rotate: 180 },
      { area: "rgt", rotate: 270 },
      { area: "br", rotate: 0 },
    ],
  },
}

export function ringGrid(count: number): RingGrid {
  return RING_GRIDS[count] ?? RING_GRIDS[4]
}

/** Live mm:ss for the current turn, ticking once a second. */
export function useTurnClock(turnStartedAt: number, running: boolean): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [turnStartedAt, running])
  const secs = Math.max(0, Math.floor((now - turnStartedAt) / 1000))
  const mm = Math.floor(secs / 60)
  const ss = secs % 60
  return `${mm}:${ss.toString().padStart(2, "0")}`
}
