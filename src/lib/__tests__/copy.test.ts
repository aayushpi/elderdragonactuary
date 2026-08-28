import { describe, expect, it } from "vitest"
import { copy } from "@/copy"
import { TOUR_STEPS } from "@/components/onboarding/steps"

/** Guards the one rule this file exists to enforce: components read their
 *  words from `src/copy.ts`, so nothing here may be blank or drift out of
 *  sync with the code that uses it. */
describe("copy", () => {
  it("has no empty strings", () => {
    const empties: string[] = []
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string") {
        if (value.trim() === "") empties.push(path)
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`))
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k)
      }
    }
    walk(copy, "")
    expect(empties).toEqual([])
  })

  it("gives every walkthrough step a title and body", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length, step.id).toBeGreaterThan(0)
      expect(step.body.length, step.id).toBeGreaterThan(0)
    }
    expect(TOUR_STEPS.length).toBe(Object.keys(copy.tour.steps).length)
  })

  it("interpolates the strings that take values", () => {
    expect(copy.tour.stepCounter(2, 13)).toBe("Step 2 of 13")
    expect(copy.settings.data.exportSub(22)).toBe("Download all 22 games as JSON or CSV.")
    expect(copy.stats.rateSub(8, 22)).toBe("8 wins / 22 games")
    expect(copy.live.damageEntry.deal(3)).toBe("Deal 3")
    expect(copy.settings.data.imported(1)).toBe("Imported 1 game.")
    expect(copy.settings.data.imported(2)).toBe("Imported 2 games.")
  })
})
