import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { OnboardingTour } from "@/components/onboarding/OnboardingTour"
import { TOUR_STEPS } from "@/components/onboarding/steps"

function setup(overrides: Partial<Parameters<typeof OnboardingTour>[0]> = {}) {
  const props = {
    open: true,
    onNavigate: vi.fn(),
    onOpenLogGame: vi.fn(),
    onCloseLogGame: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  }
  render(<OnboardingTour {...props} />)
  return props
}

beforeEach(() => {
  localStorage.clear()
})

describe("OnboardingTour", () => {
  it("renders nothing when closed", () => {
    setup({ open: false })
    expect(screen.queryByTestId("onboarding-card")).toBeNull()
  })

  it("opens on the welcome step and walks forward", () => {
    setup()
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeTruthy()
    expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText(TOUR_STEPS[1].title)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeTruthy()
  })

  it("drives the app to the surface each step describes", () => {
    const props = setup()
    // the welcome step closes any open log drawer
    expect(props.onCloseLogGame).toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(props.onNavigate).toHaveBeenCalledWith("/stats")

    const logStep = TOUR_STEPS.findIndex((s) => s.drawer === "log")
    for (let i = 1; i < logStep; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }))
    }
    expect(props.onOpenLogGame).toHaveBeenCalled()
  })

  it("can be skipped from any step", () => {
    const props = setup()
    fireEvent.click(screen.getByRole("button", { name: /Skip tour/ }))
    expect(props.onFinish).toHaveBeenCalledWith("skipped", TOUR_STEPS[0].id, 0)
  })

  it("skips on Escape", () => {
    const props = setup()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(props.onFinish).toHaveBeenCalledWith("skipped", TOUR_STEPS[0].id, 0)
  })

  it("finishes after the last step", () => {
    const props = setup()
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }))
    }
    const last = TOUR_STEPS[TOUR_STEPS.length - 1]
    expect(screen.getByText(last.title)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    expect(props.onFinish).toHaveBeenCalledWith("completed", last.id, TOUR_STEPS.length - 1)
  })

  it("covers the stats, track-game, and live-game surfaces", () => {
    const routes = TOUR_STEPS.map((s) => s.route).filter(Boolean)
    expect(routes).toContain("/stats")
    expect(routes).toContain("/live")
    expect(TOUR_STEPS.some((s) => s.drawer === "log")).toBe(true)
  })
})
