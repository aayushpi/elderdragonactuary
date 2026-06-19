/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { LoggedOutHomePage } from "@/pages/LoggedOutHomePage"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Smoke test for the logged-out app simulation: it must mount and drive the
 * real Dashboard / Stats / History pages (fed by demo data) plus the Settings
 * replica without crashing.
 */
function mount() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  act(() => {
    createRoot(container).render(<LoggedOutHomePage />)
  })
  return container
}

function clickTab(container: HTMLElement, label: string) {
  const btn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === label
  )
  if (!btn) throw new Error(`tab "${label}" not found`)
  act(() => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

describe("LoggedOutHomePage simulation", () => {
  it("renders the real Dashboard by default with demo data", () => {
    const c = mount()
    const text = c.textContent ?? ""
    expect(text).toContain("Shuffle, Ramp, Study, Send.")
    expect(text).toContain("Games")
    expect(text).toContain("Win rate")
    expect(text).toContain("Recent games")
  })

  it("switches to the real Stats page", () => {
    const c = mount()
    clickTab(c, "Stats")
    const text = c.textContent ?? ""
    expect(text).toContain("Avg win turn")
    expect(text).toContain("Win rate by starting turn")
  })

  it("switches to the real History page", () => {
    const c = mount()
    clickTab(c, "History")
    const text = c.textContent ?? ""
    expect(text).toContain("History")
    expect(text.toLowerCase()).toContain("games")
  })

  it("switches to the Settings replica", () => {
    const c = mount()
    clickTab(c, "Settings")
    const text = c.textContent ?? ""
    expect(text).toContain("Appearance")
    expect(text).toContain("Accent")
    expect(text).toContain("Export games")
  })
})
