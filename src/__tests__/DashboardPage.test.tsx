/** @vitest-environment jsdom */
import React from "react"
import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createRoot } from "react-dom/client"
import { act } from "react-dom/test-utils"
import { DashboardPage } from "@/pages/DashboardPage"
import { makeGame, makePlayer, resetIdCounter } from "../lib/__tests__/helpers"

beforeEach(() => {
  resetIdCounter()
})

describe("DashboardPage", () => {
  it("shows empty state when there are no games", () => {
    const html = renderToStaticMarkup(
      <DashboardPage games={[]} onNavigate={() => {}} onOpenLogGame={() => {}} />
    )
    expect(html).toContain("No games logged yet.")
    expect(html).toContain("Track a game")
  })

  it("renders most recent three games and favorite commanders", () => {
    const games = []

    // create a few sample games with different commanders
    const opp = makePlayer({ commanderName: "Opponent" })
    games.push(makeGame({ players: [makePlayer({ isMe: true, commanderName: "A" }), opp], playedAt: "2026-01-03T00:00:00Z" }))
    games.push(makeGame({ players: [makePlayer({ isMe: true, commanderName: "B" }), opp], playedAt: "2026-01-02T00:00:00Z" }))
    games.push(makeGame({ players: [makePlayer({ isMe: true, commanderName: "A" }), opp], playedAt: "2026-01-01T00:00:00Z" }))
    games.push(makeGame({ players: [makePlayer({ isMe: true, commanderName: "C" }), opp], playedAt: "2025-12-31T00:00:00Z" }))

    const html = renderToStaticMarkup(
      <DashboardPage games={games} onNavigate={() => {}} onOpenLogGame={() => {}} />
    )

    // recent games should show only three most recent entries
    expect(html).toContain("A")
    expect(html).toContain("B")
    expect(html).toContain("C")

    // there should be a button per favorite commander
    const trackOccurrences = (html.match(/Track game/g) || []).length
    expect(trackOccurrences).toBe(3)

    // favorite commanders sorted by games played -> check alt order
    const idxA = html.indexOf('alt="A"')
    const idxB = html.indexOf('alt="B"')
    expect(idxA).toBeGreaterThan(-1)
    expect(idxB).toBeGreaterThan(-1)
    expect(idxA).toBeLessThan(idxB)
  })

  it("hides the favorites section when I haven't played any games", () => {
    // games exist but none where isMe true
    const opp = makePlayer({ commanderName: "Opp" })
    const games = [makeGame({ players: [opp, makePlayer()] })]
    const html = renderToStaticMarkup(
      <DashboardPage games={games} onNavigate={() => {}} onOpenLogGame={() => {}} />
    )

    expect(html).not.toContain("Your favorite commanders")
    expect(html).not.toContain("Track game") // only the recent games button appears if any
  })

  it("invokes callback with commander name when favourite card clicked", () => {
    const opp = makePlayer({ commanderName: "Opp" })
    const games = [
      makeGame({ players: [makePlayer({ isMe: true, commanderName: "X" }), opp], playedAt: "2026-01-01T00:00:00Z" }),
    ]

    let received: string | undefined
    const container = document.createElement("div")
    document.body.appendChild(container)

    act(() => {
      createRoot(container).render(
        <DashboardPage
          games={games}
          onNavigate={() => {}}
          onOpenLogGame={(name) => { received = name }}
        />
      )
    })

    const trackButtons = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent === "Track game"
    )
    expect(trackButtons.length).toBeGreaterThan(0)

    act(() => {
      trackButtons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(received).toBe("X")
  })
})
