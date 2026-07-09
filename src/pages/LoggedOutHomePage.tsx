import { useEffect, useState } from "react"
import { AuthForm } from "@/components/AuthForm"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { AppSimulation } from "@/components/home/AppMockups"
import { Wordmark } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"

interface LoggedOutHomePageProps {
  defaultSignInOpen?: boolean
}

const BTN = "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all cursor-pointer rounded-[10px]"
const BTN_MD = "h-9 px-4 text-sm"
const BTN_LG = "h-12 px-7 text-[15px] rounded-xl"
const BTN_PRIMARY = "bg-primary text-primary-foreground hover:opacity-90"
const BTN_GHOST = "text-muted-foreground hover:bg-muted hover:text-foreground"
const BTN_OUTLINE = "border border-input bg-transparent text-foreground hover:bg-muted"

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
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--background)/0.88)] pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-[56px] max-w-[1280px] items-center justify-between gap-4 px-[clamp(14px,3.5vw,40px)]">
          <Wordmark />
          <div className="flex items-center gap-1.5">
            <button onClick={() => openAuth("login")} className={cn(BTN, BTN_MD, BTN_GHOST)}>
              Sign in
            </button>
            <button onClick={() => openAuth("signup")} className={cn(BTN, BTN_MD, BTN_PRIMARY)}>
              Track your first game
            </button>
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[620px] eda-glow" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[620px] eda-grid" />

        <div className="relative mx-auto max-w-[1280px] px-[clamp(14px,3.5vw,40px)]">
          {/* Marketing hero */}
          <section className="pt-[clamp(40px,7vw,84px)] text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              The actuary for your playgroup
            </span>
            <h1 className="mx-auto mt-5 max-w-[18ch] text-[clamp(36px,5.6vw,68px)] font-bold leading-[1.05] tracking-[-0.035em] [text-wrap:balance]">
              Shuffle, Ramp, Study, Send.
            </h1>
            <p className="mx-auto mt-5 max-w-[56ch] text-[clamp(16px,1.6vw,19px)] text-muted-foreground [text-wrap:pretty]">
              Log Commander games in two taps and unlock in-depth statistics — win rates by seat and
              commander, performance across your pods, the cards that actually close games, and a lot
              more. Free, and it works at any table.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => openAuth("signup")} className={cn(BTN, BTN_LG, BTN_PRIMARY)}>
                Track your first game
              </button>
              <a href="#demo" className={cn(BTN, BTN_LG, BTN_OUTLINE)}>
                Explore the demo
              </a>
            </div>
          </section>

          {/* The app, near full-bleed */}
          <section id="demo" className="scroll-mt-20 pb-[clamp(40px,6vw,80px)] pt-[clamp(32px,5vw,56px)]">
            <div className="fade-up h-[clamp(560px,80vh,900px)]">
              <AppSimulation onOpenAuth={openAuth} />
            </div>
          </section>
        </div>
      </main>

      {/* Closing CTA */}
      <section className="border-t border-border py-[clamp(48px,7vw,96px)] text-center">
        <div className="mx-auto max-w-[1280px] px-[clamp(14px,3.5vw,40px)]">
          <h2 className="mx-auto max-w-[20ch] text-[clamp(26px,3.4vw,42px)] font-bold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">
            Politics is temporary. Variance is forever.
          </h2>
          <p className="mx-auto mt-4 max-w-[44ch] text-[clamp(15px,1.6vw,18px)] text-muted-foreground [text-wrap:pretty]">
            Start your ledger now — the numbers will be more embarrassing than you think.
          </p>
          <button onClick={() => openAuth("signup")} className={cn(BTN, BTN_LG, BTN_PRIMARY, "mt-8")}>
            Track your first game
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-9 pb-[max(2.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-[clamp(14px,3.5vw,40px)] text-xs">
          <a href="https://aayush.fyi" target="_blank" rel="noopener noreferrer" className="text-primary transition-colors hover:text-primary">
            Made by Aayush.
          </a>
          Be kind, scoop at sorcery speed.
        </div>
      </footer>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="sm:max-w-md">
          <AuthForm key={authMode} defaultMode={authMode} onSignedIn={() => setSignInOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
