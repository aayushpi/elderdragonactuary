import { useEffect, useRef, useState } from "react"
import { ArrowRight, Users, Clock, Pencil, ChevronLeft, GripVertical, X, Plus, UserPlus, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SECTION_LABEL } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"
import type { SeatPosition } from "@/types"
import { genId, type LiveConfig } from "@/live/engine"
import type { RichPod } from "./setupData"
import { type DraftSeat, blankSeat, podToRoster, randomStarter, toConfig } from "./setupShared"
import { StarterBar } from "./StarterBar"

/* ============================================================================
 * Variant A — "Pod & table" (commanders are chosen in-game)
 *
 * Thesis: setup is about *who's at the table*, not decks. Tap a pod to jump
 * straight into the game; commanders are entered on the board (tap a seat's
 * "+ Commander"). Or open the roster to add/remove players, rename, rapidly
 * type fresh names, and tap-to-add regulars — then start.
 * ==========================================================================*/

function relative(iso?: string): string {
  if (!iso) return ""
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 60) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const DOT: Record<string, string> = { W: "#E2A60C", U: "#1668E3", B: "#7C3AED", R: "#E11D2B", G: "#15A53C" }
function memberDot(colors?: string[]): string {
  const c = (colors ?? []).filter((x) => DOT[x])
  return c.length === 1 ? DOT[c[0]] : c.length === 0 ? "#64748B" : "#C99A1E"
}

function reindex(seats: DraftSeat[]): DraftSeat[] {
  return seats.map((s, i) => ({ ...s, seatPosition: (i + 1) as SeatPosition, isMe: i === 0 }))
}

export function Setup({
  pods,
  knownPlayers = [],
  onStart,
  onExit,
}: {
  pods: RichPod[]
  knownPlayers?: string[]
  onStart: (c: LiveConfig) => void
  onExit?: () => void
}) {
  const [seats, setSeats] = useState<DraftSeat[] | null>(null)
  const [pod, setPod] = useState<RichPod | null>(null)
  const [starter, setStarter] = useState<SeatPosition>(1)
  const [editName, setEditName] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const addRef = useRef<HTMLInputElement>(null)

  function startNow(p: RichPod) {
    const { seats: s } = podToRoster(p)
    onStart(toConfig(s, randomStarter(s), p))
  }
  function openPod(p: RichPod) {
    const { seats: s } = podToRoster(p)
    setSeats(s)
    setPod(p)
    setStarter(1)
  }
  function newTable() {
    setSeats([blankSeat(1), { id: genId(), seatPosition: 2, isMe: false, displayName: "", commanderName: "" }])
    setPod(null)
    setStarter(1)
  }

  function addPlayer(name = "") {
    setSeats((prev) => {
      if (!prev || prev.length >= 6) return prev
      return reindex([
        ...prev,
        { id: genId(), seatPosition: 6, isMe: false, displayName: name.trim(), commanderName: "" },
      ])
    })
  }
  function removePlayer(id: string) {
    setSeats((prev) => {
      if (!prev || prev.length <= 2) return prev
      const next = reindex(prev.filter((s) => s.id !== id))
      if (starter > next.length) setStarter(1)
      return next
    })
  }
  function rename(id: string, displayName: string) {
    setSeats((prev) => prev && prev.map((s) => (s.id === id ? { ...s, displayName } : s)))
  }
  const draggingRef = useRef<string | null>(null)
  const dragOverRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => {
    if (!draggingId) return
    document.body.style.touchAction = "none"
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.touchAction = ""
      document.body.style.userSelect = ""
    }
  }, [draggingId])

  function startDrag(id: string, e: React.PointerEvent) {
    e.preventDefault()
    draggingRef.current = id
    dragOverRef.current = null
    setDraggingId(id)
    setDragOverId(null)
    const move = (ev: PointerEvent) => {
      const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-player-row]")
      const overId = (el as HTMLElement | null)?.getAttribute("data-player-row") ?? null
      const next = overId !== draggingRef.current ? overId : null
      if (next !== dragOverRef.current) {
        dragOverRef.current = next
        setDragOverId(next)
      }
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      const srcId = draggingRef.current
      const tgtId = dragOverRef.current
      draggingRef.current = null
      dragOverRef.current = null
      setDraggingId(null)
      setDragOverId(null)
      if (srcId && tgtId && srcId !== tgtId) {
        setSeats((prev) => {
          if (!prev) return prev
          const srcIdx = prev.findIndex((s) => s.id === srcId)
          const tgtIdx = prev.findIndex((s) => s.id === tgtId)
          if (srcIdx === -1 || tgtIdx === -1) return prev
          const next = [...prev]
          ;[next[srcIdx], next[tgtIdx]] = [next[tgtIdx], next[srcIdx]]
          return reindex(next)
        })
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  function commitNew() {
    const n = newName.trim()
    if (!n) return
    addPlayer(n)
    setNewName("")
    addRef.current?.focus()
  }

  // ---- Landing ----
  if (!seats) {
    return (
      <Shell title="Start a live game" subtitle="Tap a pod to jump in — set commanders at the table." onBack={onExit}>
        {pods.length > 0 && (
          <section className="space-y-2">
            <span className={SECTION_LABEL}>Your pods · tap to start</span>
            <div className="space-y-2">
              {pods.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-stretch overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary"
                >
                  <button onClick={() => startNow(p)} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
                    <div className="flex -space-x-1.5">
                      {p.members.slice(0, 5).map((mem) => (
                        <span
                          key={mem.name}
                          style={{ backgroundColor: memberDot(mem.commander?.colorIdentity) }}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[11px] font-bold text-white"
                        >
                          {mem.name.charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{p.label}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {p.size}
                        <Clock className="h-3 w-3" /> {relative(p.lastPlayedISO)}
                      </div>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                  </button>
                  <button
                    onClick={() => openPod(p)}
                    aria-label="Edit roster"
                    className="flex w-11 shrink-0 items-center justify-center border-l border-border text-muted-foreground hover:bg-muted/60"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <Button variant="outline" size="lg" className="w-full gap-2" onClick={newTable}>
          <UserPlus className="h-4 w-4" /> New table
        </Button>
      </Shell>
    )
  }

  // ---- Roster editor ----
  const unaddedKnown = knownPlayers.filter(
    (n) => !seats.some((s) => s.displayName.trim().toLowerCase() === n.toLowerCase())
  )

  return (
    <Shell
      title={pod ? "Tonight's table" : "Who's playing?"}
      subtitle="Add, remove, or rename players. Commanders are set at the table."
      onBack={() => setSeats(null)}
    >
      <section className="space-y-2">
        <span className={SECTION_LABEL}>
          Players · {seats.length}
          {seats.length >= 6 && " (max)"}
        </span>
        <div className="space-y-2">
          {seats.map((s, i) => (
            <div
              key={s.id}
              data-player-row={s.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-card p-2.5 transition-colors",
                draggingId === s.id ? "opacity-40" : dragOverId === s.id ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <button
                onPointerDown={(e) => startDrag(s.id, e)}
                aria-label="Drag to reorder"
                className="flex h-7 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded text-muted-foreground active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">
                {i + 1}
              </span>
              {editName === s.id ? (
                <Input
                  autoFocus
                  value={s.displayName}
                  placeholder={i === 0 ? "You" : `Player ${i + 1}`}
                  onChange={(e) => rename(s.id, e.target.value)}
                  onBlur={() => setEditName(null)}
                  onKeyDown={(e) => e.key === "Enter" && setEditName(null)}
                  className="h-8 flex-1"
                />
              ) : (
                <button
                  onClick={() => setEditName(s.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-semibold"
                >
                  <span className="truncate">{s.displayName || `Player ${i + 1}`}</span>
                  <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => removePlayer(s.id)}
                disabled={seats.length <= 2}
                aria-label="Remove player"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* rapid fresh-name entry */}
        {seats.length < 6 && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-2 pl-3">
            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={addRef}
              value={newName}
              placeholder="Add player — type a name, press Enter"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitNew()}
              className="h-8 flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
            />
            <button
              onClick={commitNew}
              disabled={!newName.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* tap-to-add regulars */}
        {unaddedKnown.length > 0 && seats.length < 6 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {unaddedKnown.slice(0, 8).map((n) => (
              <button
                key={n}
                onClick={() => addPlayer(n)}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary"
              >
                <Plus className="h-3 w-3" /> {n}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* quick pod fill */}
      {pods.length > 0 && (
        <section className="space-y-1.5">
          <span className={SECTION_LABEL}>Load a pod</span>
          <div className="flex flex-wrap gap-1.5">
            {pods.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSeats(podToRoster(p).seats)
                  setPod(p)
                  setStarter(1)
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  pod?.id === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <span className={SECTION_LABEL}>Who goes first?</span>
        <StarterBar seats={seats} value={starter} onChange={setStarter} />
      </section>

      <div className="mt-auto">
        <Button size="lg" className="w-full gap-2" onClick={() => onStart(toConfig(seats, starter, pod ?? undefined))}>
          Start game <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Shell>
  )
}

/* ---- Table layout SVG diagrams, matching ringGrid exactly ---- */

type SeatRect = { x: number; y: number; w: number; h: number; me?: boolean }

const W = 120
const H = 160

const LAYOUTS: Record<number, SeatRect[]> = {
  2: [
    { x: 20, y: 88, w: 80, h: 52, me: true },   // bot (seat 1, you)
    { x: 20, y: 20, w: 80, h: 52 },              // top (seat 2)
  ],
  3: [
    { x: 20, y: 90, w: 80, h: 52, me: true },    // bot (seat 1)
    { x: 8,  y: 20, w: 48, h: 60 },              // tl (seat 2)
    { x: 64, y: 20, w: 48, h: 60 },              // tr (seat 3)
  ],
  4: [
    { x: 20, y: 112, w: 80, h: 40, me: true },   // bot
    { x: 8,  y: 55,  w: 32, h: 50 },             // lft
    { x: 20, y: 10,  w: 80, h: 40 },             // top
    { x: 80, y: 55,  w: 32, h: 50 },             // rgt
  ],
  5: [
    { x: 8,  y: 105, w: 50, h: 42, me: true },   // bl (seat 1)
    { x: 8,  y: 55,  w: 32, h: 45 },             // lft (seat 2)
    { x: 8,  y: 10,  w: 104, h: 40 },            // top (seat 3, full width)
    { x: 80, y: 55,  w: 32, h: 45 },             // rgt (seat 4)
    { x: 62, y: 105, w: 50, h: 42 },             // br (seat 5)
  ],
  6: [
    { x: 8,  y: 105, w: 50, h: 42, me: true },   // bl (seat 1)
    { x: 8,  y: 55,  w: 32, h: 45 },             // lft (seat 2)
    { x: 8,  y: 10,  w: 50, h: 40 },             // tl (seat 3)
    { x: 62, y: 10,  w: 50, h: 40 },             // tr (seat 4)
    { x: 80, y: 55,  w: 32, h: 45 },             // rgt (seat 5)
    { x: 62, y: 105, w: 50, h: 42 },             // br (seat 6)
  ],
}

function TableLayoutIcon({ count }: { count: number }) {
  const seats = LAYOUTS[count] ?? LAYOUTS[4]
  return (
    <div className="flex justify-center py-1">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {seats.map((s, i) => (
          <rect
            key={i}
            x={s.x} y={s.y} width={s.w} height={s.h}
            rx={8}
            fill={s.me ? "hsl(var(--primary))" : "hsl(var(--muted))"}
            stroke={s.me ? "hsl(var(--primary))" : "hsl(var(--border))"}
            strokeWidth={1.5}
            opacity={s.me ? 1 : 0.7}
          />
        ))}
      </svg>
    </div>
  )
}


export function Shell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-5 px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <header className="space-y-1">
        {onBack && (
          <button onClick={onBack} className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </div>
  )
}
