import { useEffect, useState } from "react"
import { AuthForm } from "@/components/AuthForm"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { AppSimulation } from "@/components/home/AppMockups"
import { Wordmark } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"

interface LoggedOutHomePageProps {
  defaultSignInOpen?: boolean
}

const BTN = "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all cursor-pointer h-9 px-4 text-sm rounded-[10px]"
const BTN_PRIMARY = "bg-primary text-primary-foreground hover:opacity-90"
const BTN_GHOST = "text-muted-foreground hover:bg-muted hover:text-foreground"

export function LoggedOutHomePage({ defaultSignInOpen = false }: LoggedOutHomePageProps) {
  const [signInOpen, setSignInOpen] = useState(defaultSignInOpen)

  useEffect(() => {
    setSignInOpen(defaultSignInOpen)
  }, [defaultSignInOpen])

  const [authMode, setAuthMode] = useState<"login" | "signup">("login")
  const openAuth = (mode: "login" | "signup") => {
    setAuthMode(mode)
    setSignInOpen(true)
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Thin header — the only chrome around the simulation */}
      <header className="z-40 shrink-0 border-b border-border bg-[hsl(var(--background)/0.88)] backdrop-blur-md">
        <div className="mx-auto flex h-[56px] max-w-[1280px] items-center justify-between gap-4 px-[clamp(14px,3.5vw,40px)]">
          <Wordmark />
          <div className="flex items-center gap-1.5">
            <button onClick={() => openAuth("login")} className={cn(BTN, BTN_GHOST)}>
              Sign in
            </button>
            <button onClick={() => openAuth("signup")} className={cn(BTN, BTN_PRIMARY)}>
              Track your first game
            </button>
          </div>
        </div>
      </header>

      {/* The app, near full-bleed */}
      <main className="relative flex-1 overflow-hidden px-[clamp(10px,3vw,32px)] pb-[clamp(12px,3vw,28px)] pt-[clamp(8px,2vw,18px)]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] eda-glow" />
        <div aria-hidden className="pointer-events-none absolute inset-0 eda-grid" />

        <div className="relative mx-auto flex h-full max-w-[1280px] flex-col">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Live demo · click any tab — no account needed
            </p>
            <p className="hidden font-mono text-[11px] text-muted-foreground sm:block">Sample data</p>
          </div>
          <div className="fade-up min-h-0 flex-1">
            <AppSimulation onOpenAuth={openAuth} />
          </div>
        </div>
      </main>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="sm:max-w-md">
          <AuthForm key={authMode} defaultMode={authMode} onSignedIn={() => setSignInOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
