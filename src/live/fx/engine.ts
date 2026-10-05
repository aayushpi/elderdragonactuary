/* ============================================================================
 * DotFx — one decorative particle layer for the live board.
 *
 * Everything that moves on the table (the attack stream, thrown damage, life
 * shed or gathered, a seat crumbling on knockout) is the same material: small
 * dots under springs, impulses and gravity. One canvas, one pool, and the frame
 * loop only runs while something is alive — a two-hour game spends almost all
 * of its time idle, and this is opened on phones.
 *
 * Purely visual. Game state never waits on an effect; the engine only reads
 * screen coordinates it is handed.
 * ==========================================================================*/

export interface Vec {
  x: number
  y: number
}

export type HitKind = "damage" | "commander" | "poison"

export const FX_COLORS = {
  stream: "#ffffff",
  armed: "#f87171",
  damage: "#f87171",
  commander: "#fcd34d",
  poison: "#4ade80",
  lifelink: "#fb7185",
  loss: "#fca5a5",
  gain: "#6ee7b7",
} as const

const MAX_PARTICLES = 1400
const SUBSTEP = 1 / 120
const GRAVITY = 900

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  /** gravity, already rotated into the owning seat's "down" */
  gx: number
  gy: number
  drag: number
  spring: number
  tx: number
  ty: number
  age: number
  /** time before the particle starts moving (it is visible while it waits) */
  delay: number
  ttl: number
  fadeIn: number
  r: number
  color: string
}

interface Flight {
  particles: Particle[]
  offsets: Vec[]
  lags: number[]
  from: Vec
  to: Vec
  down: Vec
  arc: Vec
  duration: number
  t: number
  amount: number
  color: string
  key?: string
  onImpact?: () => void
}

export interface DragState {
  source: Vec
  pointer: Vec
  armed: boolean
  /** the centre "damage all" drop zone, drawn as a ring of dots */
  zone?: { center: Vec; radius: number; armed: boolean }
}

export interface AttackSpec {
  from: Vec
  targets: Array<{ key: string; at: Vec; down: Vec }>
  kind: HitKind
  amount: number
  /** where a lifelink heart flies back to after each hit */
  lifelink?: { key: string; at: Vec; down: Vec }
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)

/* ---- formations ------------------------------------------------------------
 * Unit-sized outlines (roughly −1…1) the thrown cluster holds while it flies,
 * so the kind of hit reads at a glance: a spark for damage, a bolt for
 * commander damage, a droplet for poison, a heart for lifelink. */

function sampleOutline(poly: Vec[], n: number): Vec[] {
  const lengths = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]
    return Math.hypot(q.x - p.x, q.y - p.y)
  })
  const total = lengths.reduce((a, b) => a + b, 0)
  const out: Vec[] = []
  for (let k = 0; k < n; k++) {
    let d = (k / n) * total
    let i = 0
    while (d > lengths[i] && i < poly.length - 1) d -= lengths[i++]
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const f = lengths[i] ? d / lengths[i] : 0
    out.push({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f })
  }
  return out
}

function sampleCurve(fn: (t: number) => Vec, n: number): Vec[] {
  return Array.from({ length: n }, (_, k) => fn((k / n) * Math.PI * 2))
}

const BOLT: Vec[] = [
  { x: 0.25, y: -1 }, { x: -0.55, y: 0.12 }, { x: -0.02, y: 0.12 },
  { x: -0.3, y: 1 }, { x: 0.58, y: -0.18 }, { x: 0.05, y: -0.18 },
]

export function formation(shape: "spark" | "bolt" | "drop" | "heart", n: number): Vec[] {
  switch (shape) {
    case "spark": {
      const star = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 ? 0.38 : 1
        return { x: Math.cos(a) * r, y: Math.sin(a) * r }
      })
      return sampleOutline(star, n)
    }
    case "bolt":
      return sampleOutline(BOLT, n)
    case "drop":
      return sampleCurve((t) => ({ x: 0.75 * Math.sin(t) * Math.sin(t / 2), y: -Math.cos(t) * 0.95 }), n)
    case "heart":
      return sampleCurve((t) => ({
        x: (16 * Math.sin(t) ** 3) / 17,
        y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17,
      }), n)
  }
}

const SHAPE_FOR: Record<HitKind, "spark" | "bolt" | "drop"> = {
  damage: "spark",
  commander: "bolt",
  poison: "drop",
}

/* ---- engine ----------------------------------------------------------------*/

export class DotFx {
  particles: Particle[] = []
  flights: Flight[] = []
  drag: DragState | null = null
  private streamPhase = 0
  private incoming = new Map<string, number>()
  private ctx: CanvasRenderingContext2D | null
  private canvas: HTMLCanvasElement | null
  private raf = 0
  private last = 0
  private dpr = 1

  constructor(canvas?: HTMLCanvasElement | null) {
    this.canvas = canvas ?? null
    this.ctx = canvas?.getContext("2d") ?? null
    this.resize()
  }

  resize() {
    if (!this.canvas) return
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(window.innerWidth * this.dpr)
    this.canvas.height = Math.round(window.innerHeight * this.dpr)
    this.draw()
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.particles = []
    this.flights = []
    this.drag = null
    this.incoming.clear()
  }

  get hasContext() {
    return this.ctx !== null
  }

  get busy() {
    return this.particles.length > 0 || this.flights.length > 0 || this.drag !== null
  }

  /** A life change at `key` should be skipped: a thrown hit is about to land there. */
  isIncoming(key: string) {
    return (this.incoming.get(key) ?? 0) > 0
  }

  private add(p: Partial<Particle> & Pick<Particle, "x" | "y" | "ttl" | "color">) {
    if (this.particles.length >= MAX_PARTICLES) return null
    const full: Particle = {
      vx: 0, vy: 0, gx: 0, gy: 0, drag: 0, spring: 0, tx: p.x, ty: p.y,
      age: 0, delay: 0, fadeIn: 0, r: 1.6, ...p,
    }
    this.particles.push(full)
    return full
  }

  /* -- drag -- */

  setDrag(next: DragState | null) {
    const prev = this.drag
    this.drag = next
    if (!next && prev) this.releaseStream(prev)
    this.kick()
  }

  private streamPoints(d: DragState): Array<Vec & { r: number }> {
    const dx = d.pointer.x - d.source.x
    const dy = d.pointer.y - d.source.y
    const len = Math.hypot(dx, dy)
    if (len < 4) return []
    const n = clamp(Math.round(len / 16), 4, 56)
    const nx = -dy / len
    const ny = dx / len
    const out: Array<Vec & { r: number }> = []
    for (let i = 0; i < n; i++) {
      const u = (i / n + this.streamPhase) % 1
      const wobble = Math.sin(u * Math.PI) * Math.sin(i * 2.1 + this.streamPhase * 14) * 3
      out.push({
        x: d.source.x + dx * u + nx * wobble,
        y: d.source.y + dy * u + ny * wobble,
        r: 1.2 + u * (d.armed ? 1.6 : 1),
      })
    }
    return out
  }

  /** On release the stream doesn't vanish — it carries on a beat and scatters. */
  private releaseStream(d: DragState) {
    const dx = d.pointer.x - d.source.x
    const dy = d.pointer.y - d.source.y
    const len = Math.hypot(dx, dy) || 1
    const color = d.armed ? FX_COLORS.armed : FX_COLORS.stream
    for (const p of this.streamPoints(d)) {
      this.add({
        x: p.x, y: p.y,
        vx: (dx / len) * rand(80, 220) + rand(-60, 60),
        vy: (dy / len) * rand(80, 220) + rand(-60, 60),
        drag: 5, ttl: rand(0.25, 0.45), r: p.r, color,
      })
    }
  }

  /* -- thrown hits -- */

  attack(spec: AttackSpec) {
    spec.targets.forEach((target, i) => {
      this.launch({
        from: spec.from,
        to: target.at,
        down: target.down,
        key: target.key,
        shape: SHAPE_FOR[spec.kind],
        color: FX_COLORS[spec.kind],
        amount: spec.amount,
        delay: i * 0.05,
        onImpact: spec.lifelink
          ? () => {
              const back = spec.lifelink!
              this.launch({
                from: target.at, to: back.at, down: back.down, key: back.key,
                shape: "heart", color: FX_COLORS.lifelink, amount: spec.amount, delay: 0.05,
                gentle: true, prebumped: true,
              })
            }
          : undefined,
      })
    })
    if (spec.lifelink) this.bump(spec.lifelink.key, spec.targets.length)
    this.kick()
  }

  private bump(key: string, by: number) {
    this.incoming.set(key, Math.max(0, (this.incoming.get(key) ?? 0) + by))
  }

  private launch(o: {
    from: Vec; to: Vec; down: Vec; key?: string; shape: "spark" | "bolt" | "drop" | "heart"
    color: string; amount: number; delay: number; onImpact?: () => void; gentle?: boolean
    /** the landing seat was already marked incoming when the attack started */
    prebumped?: boolean
  }) {
    const amount = Math.max(1, o.amount)
    const n = Math.round(clamp(10 + amount * 2.5, 12, 64))
    const size = 9 + Math.min(amount, 20) * 0.8
    const dist = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y)
    // throws arc to one side, like a lobbed card, instead of a dead-straight line
    const side = Math.random() < 0.5 ? -1 : 1
    const arc = dist > 1
      ? { x: (-(o.to.y - o.from.y) / dist) * dist * 0.14 * side, y: ((o.to.x - o.from.x) / dist) * dist * 0.14 * side }
      : { x: 0, y: 0 }
    const offsets = formation(o.shape, n).map((p) => ({ x: p.x * size, y: p.y * size }))
    const particles: Particle[] = []
    for (const off of offsets) {
      const p = this.add({
        x: o.from.x + off.x * 0.2 + rand(-3, 3),
        y: o.from.y + off.y * 0.2 + rand(-3, 3),
        spring: 420, drag: 30, ttl: Infinity, fadeIn: 0.08, r: rand(1.4, 2.1), color: o.color,
      })
      if (p) particles.push(p)
    }
    if (o.key && !o.prebumped) this.bump(o.key, 1)
    this.flights.push({
      particles,
      offsets,
      // the tail lags the head a touch, so the cluster streaks rather than slides
      lags: offsets.map(() => rand(0, 0.07)),
      from: o.from, to: o.to, down: o.down, arc,
      duration: (o.gentle ? 0.5 : 0.34) + Math.min(dist, 900) / 3200,
      t: -o.delay,
      amount,
      color: o.color,
      key: o.key,
      onImpact: o.onImpact,
    })
  }

  private impact(f: Flight) {
    if (f.key) this.bump(f.key, -1)
    const power = 1 + Math.min(f.amount, 20) / 12
    for (const p of f.particles) {
      const dx = p.x - f.to.x
      const dy = p.y - f.to.y
      const d = Math.hypot(dx, dy) || 1
      const a = d > 1 ? Math.atan2(dy, dx) + rand(-0.5, 0.5) : rand(0, Math.PI * 2)
      const v = rand(160, 380) * power
      p.vx = Math.cos(a) * v
      p.vy = Math.sin(a) * v
      p.spring = 0
      p.drag = 2.6
      p.gx = f.down.x * GRAVITY
      p.gy = f.down.y * GRAVITY
      p.age = 0
      p.ttl = rand(0.55, 0.95)
    }
    // shock ring
    const ring = Math.round(14 + Math.min(f.amount, 20))
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2
      this.add({
        x: f.to.x, y: f.to.y,
        vx: Math.cos(a) * 340 * power, vy: Math.sin(a) * 340 * power,
        drag: 7, ttl: 0.4, r: 1.3, color: f.color,
      })
    }
    f.onImpact?.()
  }

  /* -- life -- */

  /** Life lost: dots chip off the number and fall toward that player's edge. */
  shed(rect: DOMRect | { x: number; y: number; width: number; height: number }, down: Vec, amount: number, color: string = FX_COLORS.loss) {
    const n = Math.round(clamp(6 + Math.abs(amount) * 4, 8, 90))
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    for (let i = 0; i < n; i++) {
      const x = rand(rect.x, rect.x + rect.width)
      const y = rand(rect.y, rect.y + rect.height)
      const a = Math.atan2(y - cy, x - cx)
      const v = rand(90, 260)
      this.add({
        x, y,
        // biased "up" for the seat, so the dots hop off before they fall
        vx: Math.cos(a) * v - down.x * rand(120, 260),
        vy: Math.sin(a) * v - down.y * rand(120, 260),
        gx: down.x * GRAVITY, gy: down.y * GRAVITY,
        drag: 1.4, ttl: rand(0.6, 1.05), r: rand(1.3, 2.2), color,
      })
    }
    this.kick()
  }

  /** Life gained: dots drift in from around the number and are absorbed. */
  gather(rect: DOMRect | { x: number; y: number; width: number; height: number }, amount: number, color: string = FX_COLORS.gain) {
    const n = Math.round(clamp(6 + Math.abs(amount) * 4, 8, 90))
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const reach = Math.max(rect.width, rect.height) * 0.6 + 26
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2)
      const r = reach * rand(0.9, 1.6)
      this.add({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        tx: rand(rect.x + rect.width * 0.15, rect.x + rect.width * 0.85),
        ty: rand(rect.y + rect.height * 0.2, rect.y + rect.height * 0.8),
        spring: 70, drag: 9, delay: rand(0, 0.12), fadeIn: 0.12,
        ttl: rand(0.5, 0.7), r: rand(1.3, 2), color,
      })
    }
    this.kick()
  }

  /** Knocked out: the seat breaks into its own colour and drops away. */
  dissolve(rect: { x: number; y: number; width: number; height: number }, down: Vec, color: string, after = 0) {
    const n = Math.round(clamp((rect.width * rect.height) / 700, 90, 420))
    for (let i = 0; i < n; i++) {
      const x = rand(rect.x, rect.x + rect.width)
      const y = rand(rect.y, rect.y + rect.height)
      // crumble from the seat's top edge (its "up") toward its bottom
      const along = ((x - rect.x) / rect.width - 0.5) * down.x + ((y - rect.y) / rect.height - 0.5) * down.y
      this.add({
        x, y,
        vx: rand(-40, 40), vy: rand(-40, 40),
        gx: down.x * GRAVITY * 0.8, gy: down.y * GRAVITY * 0.8,
        drag: 0.8, delay: after + clamp(0.25 - along * 0.4, 0, 0.5) + rand(0, 0.1),
        fadeIn: 0.05, ttl: rand(0.9, 1.3), r: rand(1.4, 2.4), color,
      })
    }
    this.kick()
  }

  /* -- loop -- */

  private kick() {
    if (this.raf || !this.ctx) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  private frame = (now: number) => {
    this.raf = 0
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.step(dt)
    this.draw()
    if (this.busy) this.raf = requestAnimationFrame(this.frame)
  }

  step(dt: number) {
    if (dt <= 0) return
    this.streamPhase = (this.streamPhase + dt * 1.6) % 1

    for (const f of this.flights) {
      f.t += dt
      if (f.t < 0) continue
      f.particles.forEach((p, i) => {
        const u = easeInOut(clamp((f.t - f.lags[i]) / f.duration, 0, 1))
        const bow = Math.sin(u * Math.PI)
        p.tx = f.from.x + (f.to.x - f.from.x) * u + f.arc.x * bow + f.offsets[i].x
        p.ty = f.from.y + (f.to.y - f.from.y) * u + f.arc.y * bow + f.offsets[i].y
      })
    }
    const landed = this.flights.filter((f) => f.t >= f.duration + 0.07)
    if (landed.length) {
      this.flights = this.flights.filter((f) => f.t < f.duration + 0.07)
      landed.forEach((f) => this.impact(f))
    }

    const steps = Math.max(1, Math.ceil(dt / SUBSTEP))
    const h = dt / steps
    for (const p of this.particles) {
      p.age += dt
      if (p.age < p.delay) continue
      for (let s = 0; s < steps; s++) {
        p.vx += ((p.tx - p.x) * p.spring + p.gx) * h
        p.vy += ((p.ty - p.y) * p.spring + p.gy) * h
        const k = Math.exp(-p.drag * h)
        p.vx *= k
        p.vy *= k
        p.x += p.vx * h
        p.y += p.vy * h
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.delay + p.ttl)
  }

  private alpha(p: Particle) {
    if (p.ttl === Infinity) return p.fadeIn ? clamp(p.age / p.fadeIn, 0, 1) : 1
    const t = Math.max(0, p.age - p.delay)
    const fadeIn = p.fadeIn ? clamp(t / p.fadeIn, 0, 1) : 1
    const fadeOut = clamp((p.ttl - t) / (p.ttl * 0.45), 0, 1)
    return fadeIn * fadeOut
  }

  draw() {
    const ctx = this.ctx
    if (!ctx || !this.canvas) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // a faint dark rim keeps every dot legible on every seat colour (red hits
    // land on the red seat, poison on the green one)
    const dot = (x: number, y: number, r: number, color: string, a: number) => {
      if (a <= 0.01) return
      ctx.globalAlpha = a * 0.45
      ctx.fillStyle = "#000"
      ctx.beginPath()
      ctx.arc(x, y, r + 1.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = a
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const p of this.particles) dot(p.x, p.y, p.r, p.color, this.alpha(p))

    const d = this.drag
    if (d) {
      const color = d.armed ? FX_COLORS.armed : FX_COLORS.stream
      for (const s of this.streamPoints(d)) dot(s.x, s.y, s.r, color, 0.9)
      dot(d.source.x, d.source.y, 4.5, color, 1)
      if (d.armed) {
        // lock-on: a tight orbit of dots around the finger
        const spin = this.streamPhase * Math.PI * 2
        for (let i = 0; i < 14; i++) {
          const a = spin + (i / 14) * Math.PI * 2
          dot(d.pointer.x + Math.cos(a) * 22, d.pointer.y + Math.sin(a) * 22, 2.2, color, 1)
        }
        dot(d.pointer.x, d.pointer.y, 6, color, 1)
      } else {
        dot(d.pointer.x, d.pointer.y, 5, color, 0.9)
      }
      if (d.zone) {
        const { center, radius, armed } = d.zone
        const n = 30
        const spin = this.streamPhase * Math.PI * 2 * (armed ? -2 : 0.5)
        const r = radius + 10 + (armed ? Math.sin(this.streamPhase * Math.PI * 8) * 3 : 0)
        for (let i = 0; i < n; i++) {
          const a = spin + (i / n) * Math.PI * 2
          dot(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r, armed ? 2.2 : 1.5, armed ? FX_COLORS.armed : FX_COLORS.stream, armed ? 1 : 0.7)
        }
      }
    }
    ctx.globalAlpha = 1
  }
}

/* ---- DOM helpers -----------------------------------------------------------*/

/** Screen-space "down" for an element, following every rotation above it (the
 *  seat's own ring rotation and the iOS orientation counter-rotation). Dots
 *  fall toward the edge of the table that player is sitting at. */
export function screenDown(el: Element | null): Vec {
  let angle = 0
  try {
    for (let node: Element | null = el; node; node = node.parentElement) {
      // computed transforms are always matrix(a, b, …) or matrix3d(a, b, …)
      const n = getComputedStyle(node).transform.match(/-?[\d.]+(?:e-?\d+)?/g)
      if (n && n.length >= 6) angle += Math.atan2(Number(n[1]), Number(n[0]))
    }
  } catch {
    angle = 0
  }
  return { x: -Math.sin(angle), y: Math.cos(angle) }
}

export function rectCenter(r: { x: number; y: number; width: number; height: number }): Vec {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}
