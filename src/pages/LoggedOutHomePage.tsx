import { useEffect, useRef, useState } from "react"
import { AuthForm } from "@/components/AuthForm"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Reveal } from "@/components/home/Reveal"
import {
  DashboardMockup,
  LiveBoardMockup,
  GlobalStatsMockup,
  PodStatsMockup,
  WinconMockup,
} from "@/components/home/AppMockups"
import { Wordmark } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"

interface LoggedOutHomePageProps {
  defaultSignInOpen?: boolean
}

const WRAP = "mx-auto max-w-[1120px] px-[clamp(20px,4.5vw,48px)]"
const BTN = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all cursor-pointer"
const BTN_MD = "h-10 px-[18px] text-sm rounded-[10px]"
const BTN_LG = "h-12 px-[26px] text-[15px] rounded-xl"
const BTN_PRIMARY = "bg-primary text-primary-foreground hover:opacity-90"
const BTN_OUTLINE = "border border-input bg-transparent text-foreground hover:bg-muted"
const EYEBROW = "font-mono text-xs font-medium uppercase tracking-[0.16em] text-primary"
const CARD = "bg-card border border-border rounded-2xl"

function CountUp({ to, className }: { to: number; className?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to)
      return
    }
    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          io.unobserve(el)
          const t0 = performance.now()
          const dur = 1300
          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / dur)
            setVal(Math.round(to * (1 - Math.pow(1 - p, 3))))
            if (p < 1) raf = requestAnimationFrame(step)
          }
          raf = requestAnimationFrame(step)
        })
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to])

  return (
    <span ref={ref} className={className}>
      {val}
    </span>
  )
}

const TILES: { label: string; value: React.ReactNode; sub: string }[] = [
  {
    label: "Win rate · Yuriko",
    value: (
      <>
        <CountUp to={58} className="tabular" />
        <span className="ml-0.5 text-[0.55em] font-semibold text-muted-foreground">%</span>
      </>
    ),
    sub: "Across 19 logged games. You knew. Now you know.",
  },
  {
    label: "Seat 1 advantage",
    value: (
      <>
        +<CountUp to={9} className="tabular" />
        <span className="ml-0.5 text-[0.55em] font-semibold text-muted-foreground">%</span>
      </>
    ),
    sub: "Settle the “who goes first” lottery with data.",
  },
  {
    label: "Craterhoof, resolved",
    value: (
      <>
        <CountUp to={71} className="tabular" />
        <span className="ml-0.5 text-[0.55em] font-semibold text-muted-foreground">%</span>
      </>
    ),
    sub: "Win rate when it resolves. 12% when it rots in hand.",
  },
  {
    label: "Your archenemy",
    value: "Dave",
    sub: "Eliminated you in 7 of your last 12 games. Coincidence has been ruled out.",
  },
]

const STAT_ROWS: { kicker: string; title: string; body: string; Mock: () => React.ReactNode }[] = [
  {
    kicker: "Global statistics",
    title: "How your commanders fare against the world",
    body: "Every logged game everywhere rolls into global win rates, meta share, and matchup curves. Find out whether Yuriko is actually broken or your pod just refuses to block ninjas.",
    Mock: GlobalStatsMockup,
  },
  {
    kicker: "Pod statistics",
    title: "Your pod, audited",
    body: "Win rate by seat, by player, by commander — inside your playgroup, where it matters. Archenemy detection included: the ledger knows who keeps eliminating you, even if you’ve forgiven him.",
    Mock: PodStatsMockup,
  },
  {
    kicker: "Win-con evaluation",
    title: "The cards that actually win games",
    body: "Tag your key cards and the actuary tracks their performance: how often each win-con closes the game when it resolves, fizzles when it’s countered, or rots in hand. Cut the ones that only win in your head.",
    Mock: WinconMockup,
  },
]

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--background)/0.88)] backdrop-blur-md">
        <div className={cn(WRAP, "flex h-[60px] items-center justify-between gap-4")}>
          <Wordmark />
          <nav className="hidden items-center gap-1 sm:flex">
            {[
              ["Features", "#features"],
              ["Statistics", "#stats"],
              ["Coming soon", "#soon"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <button onClick={() => openAuth("login")} className={cn(BTN, BTN_MD, BTN_PRIMARY)}>
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient Linear-style backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0 eda-grid" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] eda-glow" />

        <div className="relative pt-[clamp(56px,8vw,104px)] text-center">
          <div className={WRAP}>
            <Reveal>
              <span className={cn(EYEBROW, "inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px]")}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                The actuary for your playgroup
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mx-auto mt-5 max-w-[18ch] text-[clamp(40px,6.2vw,76px)] font-bold leading-[1.04] tracking-[-0.035em] [text-wrap:balance]">
                Shuffle, Ramp,{" "}
                <span className="eda-gradient-text">Study</span>, Send.
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mx-auto mt-5 max-w-[56ch] text-[clamp(16px,1.6vw,19px)] text-muted-foreground [text-wrap:pretty]">
                Effortlessly track Commander games and unlock in-depth statistics, performance across
                your pods, key win-con cards, and a lot more.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button onClick={() => openAuth("signup")} className={cn(BTN, BTN_LG, BTN_PRIMARY)}>
                  Track your first game
                </button>
                <a href="#features" className={cn(BTN, BTN_LG, BTN_OUTLINE)}>
                  See it in action
                </a>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Hero product window — the live app, not a screenshot */}
        <div className="relative pb-[clamp(48px,7vw,96px)] pt-[clamp(36px,5vw,64px)]">
          <div className={WRAP}>
            <Reveal delay={0.26}>
              <div className="rounded-[22px] border border-border bg-raised p-[clamp(6px,1vw,12px)] shadow-[0_30px_90px_hsl(240_8%_8%/0.16)] dark:shadow-[0_30px_90px_hsl(0_0%_0%/0.45)]">
                <DashboardMockup />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* At the table */}
      <section id="features" className="border-t border-border py-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <Reveal>
            <span className={cn(EYEBROW, "mb-3.5 block text-muted-foreground")}>At the table</span>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal className={cn(CARD, "flex flex-col gap-4 p-[26px]")}>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Log game · seat 2
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    ["Atraxa, Praetors' Voice", "Priya"],
                    ["Yuriko, the Tiger's Shadow", "You"],
                    ["Krenko, Mob Boss", "Marisol"],
                    ["Korvold, Fae-Cursed King", "Dave"],
                  ].map(([cmdr, who], i) => (
                    <div
                      key={cmdr}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                        i === 1 ? "border-primary/40 bg-primary/5" : "border-border bg-background"
                      )}
                    >
                      <span className="truncate text-[12.5px] font-medium">{cmdr}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{who}</span>
                    </div>
                  ))}
                </div>
              </div>
              <h3 className="text-[19px] font-semibold tracking-[-0.015em]">Game logging in two taps</h3>
              <p className="text-[14.5px] text-muted-foreground [text-wrap:pretty]">
                Seats, commanders, result — logged before the next shuffle. Your regulars are
                remembered per pod-mate; strangers are found by color identity, so nobody types
                “Yurlok of Scorch Thrash” under pressure.
              </p>
            </Reveal>
            <Reveal delay={0.08} className={cn(CARD, "flex flex-col gap-4 p-[26px]")}>
              <LiveBoardMockup />
              <h3 className="text-[19px] font-semibold tracking-[-0.015em]">Live game tracking</h3>
              <p className="text-[14.5px] text-muted-foreground [text-wrap:pretty]">
                One phone in the middle of the table tracks all four seats — life, commander damage,
                turn count. Guests install nothing, and every tap quietly becomes a data point for
                the autopsy.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* The post-game autopsy */}
      <section id="stats" className="border-t border-border bg-[hsl(var(--card)/0.5)] py-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <Reveal className="mb-[clamp(36px,5vw,64px)] max-w-[60ch]">
            <span className={cn(EYEBROW, "mb-3.5 block text-muted-foreground")}>After the game</span>
            <h2 className="text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">
              The post-game autopsy
            </h2>
            <p className="mt-3.5 text-[clamp(16px,1.6vw,19px)] text-muted-foreground [text-wrap:pretty]">
              Logging is the chore. This is the payoff — three ledgers deep, from the whole format
              down to the card that won it.
            </p>
          </Reveal>

          <div className="flex flex-col gap-[clamp(40px,6vw,80px)]">
            {STAT_ROWS.map((row, i) => {
              const Mock = row.Mock
              return (
                <div
                  key={row.kicker}
                  className="grid grid-cols-1 items-center gap-[clamp(28px,5vw,72px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
                >
                  <Reveal className={cn(i % 2 === 1 && "lg:order-2")}>
                    <span className={EYEBROW}>{row.kicker}</span>
                    <h3 className="mt-3.5 text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-0.02em]">
                      {row.title}
                    </h3>
                    <p className="mt-3 max-w-[46ch] text-[15.5px] text-muted-foreground [text-wrap:pretty]">
                      {row.body}
                    </p>
                  </Reveal>
                  <Reveal
                    delay={0.08}
                    className={cn(
                      "rounded-[18px] border border-border bg-raised p-[clamp(6px,0.8vw,10px)] shadow-[0_20px_60px_hsl(240_8%_8%/0.1)] dark:shadow-[0_20px_60px_hsl(0_0%_0%/0.35)]",
                      i % 2 === 1 && "lg:order-1"
                    )}
                  >
                    <Mock />
                  </Reveal>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Sample stat tiles */}
      <section className="bg-[hsl(var(--card)/0.5)] pb-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map((tile, i) => (
              <Reveal key={tile.label} delay={i * 0.06} className={cn(CARD, "flex flex-col gap-2 p-[22px]")}>
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {tile.label}
                </span>
                <span className="text-[clamp(30px,3vw,40px)] font-bold leading-[1.05] tracking-[-0.03em] tabular">
                  {tile.value}
                </span>
                <span className="text-[12.5px] text-muted-foreground [text-wrap:pretty]">{tile.sub}</span>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 font-mono text-xs text-muted-foreground">
            Sample data. Your numbers will be more embarrassing.
          </p>
        </div>
      </section>

      {/* Coming soon */}
      <section id="soon" className="border-t border-border py-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <Reveal className="grid grid-cols-1 items-center gap-[clamp(20px,4vw,56px)] rounded-[20px] border border-dashed border-input bg-[hsl(var(--card)/0.4)] p-[clamp(28px,4vw,48px)] md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <span className={EYEBROW}>Coming soon</span>
              <h3 className="mt-3.5 text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-0.02em]">
                Commander suggestions
              </h3>
              <p className="mt-3 max-w-[52ch] text-[15.5px] text-muted-foreground [text-wrap:pretty]">
                The actuary studies your pod’s meta, your win-cons, and the seats you keep losing
                from — then recommends your next commander. Underwritten by data, not by whatever was
                just banned.
              </p>
            </div>
            <button onClick={() => openAuth("signup")} className={cn(BTN, BTN_LG, BTN_OUTLINE)}>
              Join the waitlist
            </button>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-[clamp(64px,9vw,130px)] text-center">
        <div className={WRAP}>
          <Reveal>
            <h2 className="text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">
              Politics is temporary.
              <br />
              Variance is forever.
            </h2>
            <p className="mx-auto mt-4 max-w-[44ch] text-[clamp(16px,1.6vw,19px)] text-muted-foreground [text-wrap:pretty]">
              Free to use. Works at any table. The ledger opens in seconds.
            </p>
            <div className="mt-8 flex justify-center">
              <button onClick={() => openAuth("login")} className={cn(BTN, BTN_LG, BTN_PRIMARY)}>
                Sign in
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-9">
        <div className={cn(WRAP, "flex flex-wrap items-center justify-between gap-4 text-xs")}>
          <a href="https://aayush.fyi" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary transition-colors">
            Made by Aayush.
          </a> Be kind, scoop at sorcery speed.
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
