/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { AuthPage } from "@/pages/AuthPage"
import { AuthProvider } from "@/providers/AuthProvider"

// ensure global fetch stub
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn())
})

describe("AuthPage", () => {
  it("renders release notes sheet on load", async () => {
    const fakeMd = "# Release\n- note"
    ;(fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => fakeMd,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthPage />
        </AuthProvider>
      )
    })

    // sheet title should appear
    expect(screen.getByText("What's New")).toBeDefined()
    // after fetch completes, content should render markdown
    expect(screen.getByText("Release")).toBeDefined()
    expect(screen.getByText("note")).toBeDefined()
  })
})
