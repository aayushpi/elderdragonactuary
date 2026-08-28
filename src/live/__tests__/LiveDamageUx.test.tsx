import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { SeatFrame } from "@/live/shared"
import { StepperEntry } from "@/live/ThrowBoard"
import { STARTING_LIFE, type LivePlayer, type PlayerRuntime } from "@/live/engine"

const player: LivePlayer = {
  id: "p1",
  seatPosition: 1,
  isMe: true,
  displayName: "You",
  commanderName: "Atraxa, Praetors' Voice",
}

const runtime: PlayerRuntime = {
  life: STARTING_LIFE,
  commanderFrom: {},
  poison: 0,
  manualKO: false,
  lethal: false,
  knockedOut: false,
}

function tap(label: string) {
  const button = screen.getByLabelText(label)
  fireEvent.pointerDown(button)
  fireEvent.pointerUp(button)
}

function renderSeat(onSelfChange = vi.fn()) {
  render(<SeatFrame player={player} rt={runtime} isActive onSelfChange={onSelfChange} onRevive={vi.fn()} onKnockout={vi.fn()} />)
  return onSelfChange
}

describe("seat life tally", () => {
  it("shows nothing until a life button is tapped", () => {
    renderSeat()
    expect(screen.queryByTestId("life-tally")).toBeNull()
  })

  it("accumulates repeated taps into one running total", () => {
    const onSelfChange = renderSeat()
    for (let i = 0; i < 5; i++) tap("lose life (hold for 10)")

    expect(onSelfChange).toHaveBeenCalledTimes(5)
    expect(screen.getByTestId("life-tally").textContent).toBe("-5")
  })

  it("counts life gained with a + sign", () => {
    renderSeat()
    tap("gain life (hold for 10)")
    tap("gain life (hold for 10)")
    expect(screen.getByTestId("life-tally").textContent).toBe("+2")
  })

  it("nets taps in both directions and hides a zero total", () => {
    renderSeat()
    tap("lose life (hold for 10)")
    tap("lose life (hold for 10)")
    expect(screen.getByTestId("life-tally").textContent).toBe("-2")
    tap("gain life (hold for 10)")
    tap("gain life (hold for 10)")
    expect(screen.queryByTestId("life-tally")).toBeNull()
  })
})

describe("damage entry stepper", () => {
  function renderStepper(onApply = vi.fn()) {
    render(<StepperEntry sourceName="You" targetName="Rin" onApply={onApply} />)
    return onApply
  }

  it("starts at 0 with the apply button disabled", () => {
    renderStepper()
    expect(screen.getByText("0")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pick an amount" })).toHaveProperty("disabled", true)
  })

  it("never steps below 0", () => {
    renderStepper()
    tap("minus (hold for 10)")
    tap("minus (hold for 10)")
    expect(screen.getByText("0")).toBeTruthy()
  })

  it("applies the amount that was dialled in", () => {
    const onApply = renderStepper()
    tap("plus (hold for 10)")
    tap("plus (hold for 10)")
    tap("plus (hold for 10)")
    fireEvent.click(screen.getByRole("button", { name: "Deal 3" }))
    expect(onApply).toHaveBeenCalledWith(3, { isCommander: false, isPoison: false, isLifelink: false })
  })
})
