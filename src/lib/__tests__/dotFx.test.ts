import { describe, expect, it } from "vitest"
import { DotFx, formation, screenDown } from "@/live/fx/engine"

const rect = { x: 100, y: 100, width: 60, height: 40 }
const down = { x: 0, y: 1 }

function run(fx: DotFx, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) fx.step(1 / 60)
}

describe("DotFx", () => {
  it("is inert without a canvas", () => {
    const fx = new DotFx(null)
    expect(fx.hasContext).toBe(false)
    expect(() => {
      fx.shed(rect, down, -3)
      fx.draw()
      fx.destroy()
    }).not.toThrow()
  })

  it("scales life particles with the size of the change and clears them", () => {
    const fx = new DotFx(null)
    fx.shed(rect, down, -1)
    const small = fx.particles.length
    fx.destroy()
    fx.shed(rect, down, -10)
    expect(fx.particles.length).toBeGreaterThan(small)
    run(fx, 2)
    expect(fx.particles).toHaveLength(0)
    expect(fx.busy).toBe(false)
  })

  it("shed dots fall toward the seat's own edge", () => {
    const fx = new DotFx(null)
    const up = { x: 0, y: -1 }
    fx.shed(rect, up, -5)
    run(fx, 0.5)
    const avgY = fx.particles.reduce((s, p) => s + p.y, 0) / fx.particles.length
    expect(avgY).toBeLessThan(rect.y + rect.height / 2)
  })

  it("marks the target incoming until the thrown hit lands", () => {
    const fx = new DotFx(null)
    fx.attack({
      from: { x: 0, y: 0 },
      targets: [{ key: "b", at: { x: 300, y: 300 }, down }],
      kind: "damage",
      amount: 4,
    })
    expect(fx.isIncoming("b")).toBe(true)
    run(fx, 1.5)
    expect(fx.isIncoming("b")).toBe(false)
    expect(fx.flights).toHaveLength(0)
  })

  it("lifelink holds the source until every heart has returned", () => {
    const fx = new DotFx(null)
    fx.attack({
      from: { x: 0, y: 0 },
      targets: [
        { key: "b", at: { x: 300, y: 0 }, down },
        { key: "c", at: { x: 0, y: 300 }, down },
      ],
      kind: "damage",
      amount: 2,
      lifelink: { key: "a", at: { x: 0, y: 0 }, down },
    })
    expect(fx.isIncoming("a")).toBe(true)
    run(fx, 0.6)
    expect(fx.isIncoming("a")).toBe(true)
    run(fx, 2)
    expect(fx.isIncoming("a")).toBe(false)
    expect(fx.isIncoming("b")).toBe(false)
    expect(fx.isIncoming("c")).toBe(false)
  })

  it("ends the drag stream with a short scatter", () => {
    const fx = new DotFx(null)
    fx.setDrag({ source: { x: 0, y: 0 }, pointer: { x: 200, y: 0 }, armed: true })
    expect(fx.busy).toBe(true)
    fx.setDrag(null)
    expect(fx.particles.length).toBeGreaterThan(0)
    run(fx, 1)
    expect(fx.busy).toBe(false)
  })
})

describe("formation", () => {
  it.each(["spark", "bolt", "drop", "heart"] as const)("%s yields unit-sized points", (shape) => {
    const pts = formation(shape, 30)
    expect(pts).toHaveLength(30)
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.05)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.05)
    }
  })
})

describe("screenDown", () => {
  it("follows rotated ancestors", () => {
    const outer = document.createElement("div")
    const inner = document.createElement("span")
    outer.style.transform = "matrix(-1, 0, 0, -1, 0, 0)"
    outer.appendChild(inner)
    document.body.appendChild(outer)
    const d = screenDown(inner)
    expect(d.x).toBeCloseTo(0)
    expect(d.y).toBeCloseTo(-1)
    outer.remove()
  })

  it("defaults to straight down", () => {
    expect(screenDown(null)).toEqual({ x: -0, y: 1 })
  })
})
