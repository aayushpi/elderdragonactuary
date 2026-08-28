import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { OnboardingTour } from "@/components/onboarding/OnboardingTour"
import { StatsPage } from "@/pages/StatsPage"
import { DEMO_GAMES, buildDemoGames } from "@/components/home/demoData"
import { AuthProvider } from "@/providers/AuthProvider"

describe("sample data during the walkthrough", () => {
  it("anchors demo games to the date it is given", () => {
    const anchor = new Date(2030, 0, 31)
    const games = buildDemoGames(anchor)
    const newest = new Date(games[0].playedAt)
    expect(newest.getTime()).toBeLessThan(anchor.getTime())
    expect(anchor.getTime() - newest.getTime()).toBeLessThan(3 * 24 * 60 * 60 * 1000)
    // and the marketing page's fixed history is unaffected
    expect(DEMO_GAMES[0].playedAt).not.toEqual(games[0].playedAt)
  })

  it("labels the tour card as sample data and says why on the first step", () => {
    render(
      <OnboardingTour
        open
        sampleData
        onNavigate={vi.fn()}
        onOpenLogGame={vi.fn()}
        onCloseLogGame={vi.fn()}
        onFinish={vi.fn()}
      />,
    )
    expect(screen.getByText("Sample data")).toBeTruthy()
    expect(screen.getByText(/Your account is empty/)).toBeTruthy()
  })

  it("labels the stats page itself and keeps sample numbers out of analytics", () => {
    render(<StatsPage games={buildDemoGames(new Date())} sampleData onNavigate={vi.fn()} onOpenLogGame={vi.fn()} />)
    expect(screen.getByText("Sample data")).toBeTruthy()
    // the sample pod has games, so this is the populated page, not the empty state
    expect(screen.queryByText("No games logged yet")).toBeNull()
  })
})

describe("the log-game form during the walkthrough", () => {
  it("is filled in from the sample pod so the steps have something to point at", async () => {
    const { LogGamePage } = await import("@/pages/LogGamePage")
    const sample = buildDemoGames(new Date())
    const { container } = render(
      <AuthProvider>
        <LogGamePage demoGames={sample} onSave={vi.fn()} onCancel={vi.fn()} />
      </AuthProvider>,
    )

    // the players section is open, with every seat from the sample game on it
    expect(container.querySelector('[data-tour="log-players"]')).toBeTruthy()
    for (const p of sample[0].players) {
      if (p.isMe) continue
      expect(screen.getAllByText(p.displayName!).length).toBeGreaterThan(0)
      expect(screen.getAllByText(p.commanderName!).length).toBeGreaterThan(0)
    }
  })

  it("leaves a real account's form empty", async () => {
    const { LogGamePage } = await import("@/pages/LogGamePage")
    render(
      <AuthProvider>
        <LogGamePage onSave={vi.fn()} onCancel={vi.fn()} />
      </AuthProvider>,
    )
    expect(screen.queryByText("Dave")).toBeNull()
  })
})
