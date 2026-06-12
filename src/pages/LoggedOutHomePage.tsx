import { useEffect, useRef, useState } from "react"
import { AuthForm } from "@/components/AuthForm"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScreenshotSlot } from "@/components/home/ScreenshotSlot"
import { Wordmark } from "@/components/modern/primitives"
import { cn } from "@/lib/utils"

interface LoggedOutHomePageProps {
  defaultSignInOpen?: boolean
}

/* Product screenshots: drop matching PNGs into public/marketing/ and they
   replace the placeholders automatically (see ScreenshotSlot). */
const SHOT = {
  heroDashboard: "/marketing/hero-dashboard.png",
  heroLive: "/marketing/hero-live.png",
  logging: "/marketing/game-logging.png",
  global: "/marketing/global-stats.png",
  pod: "/marketing/pod-stats.png",
  wincon: "/marketing/wincon.png",
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

const SEATS: { cmdr: string; flip: boolean }[] = [
  { cmdr: "Atraxa · Priya", flip: true },
  { cmdr: "Yuriko · Dave", flip: true },
  { cmdr: "Krenko · Marisol", flip: false },
  { cmdr: "Korvold · You", flip: false },
]

function MiniBoard() {
  const [lives, setLives] = useState([34, 21, 40, 26])
  const [bump, setBump] = useState(0)
  const [tickIdx, setTickIdx] = useState(-1)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => {
      setLives((prev) => {
        const i = Math.floor(Math.random() * prev.length)
        const deltas = [-3, -2, -1, -1, -1, 1]
        let nv = prev[i] + deltas[Math.floor(Math.random() * deltas.length)]
        if (nv < 1) nv = 40
        if (nv > 60) nv = 60
        const next = [...prev]
        next[i] = nv
        setTickIdx(i)
        setBump((b) => b + 1)
        return next
      })
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
      {SEATS.map((seat, i) => (
        <div
          key={seat.cmdr}
          className="relative flex min-h-[96px] flex-col items-center justify-center gap-1.5 bg-card p-3"
        >
          <div className={cn("flex flex-col items-center gap-1.5 text-center", seat.flip && "rotate-180")}>
            <span
              key={`${i}-${bump}`}
              className={cn(
                "text-[34px] font-bold leading-none tracking-tight tabular",
                tickIdx === i && "life-tick"
              )}
            >
              {lives[i]}
            </span>
            <span className="max-w-[26ch] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">
              {seat.cmdr}
            </span>
          </div>
        </div>
      ))}
    </div>
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

const STAT_ROWS: { kicker: string; title: string; body: string; src: string; placeholder: string }[] = [
  {
    kicker: "Global statistics",
    title: "How your commanders fare against the world",
    body: "Every logged game everywhere rolls into global win rates, meta share, and matchup curves. Find out whether Yuriko is actually broken or your pod just refuses to block ninjas.",
    src: SHOT.global,
    placeholder: "Global statistics",
  },
  {
    kicker: "Pod statistics",
    title: "Your pod, audited",
    body: "Win rate by seat, by player, by commander — inside your playgroup, where it matters. Archenemy detection included: the ledger knows who keeps eliminating you, even if you’ve forgiven him.",
    src: SHOT.pod,
    placeholder: "Pod statistics",
  },
  {
    kicker: "Win-con evaluation",
    title: "The cards that actually win games",
    body: "Tag your key cards and the actuary tracks their performance: how often each win-con closes the game when it resolves, fizzles when it’s countered, or rots in hand. Cut the ones that only win in your head.",
    src: SHOT.wincon,
    placeholder: "Win-con card evaluation",
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
      <section className="py-[clamp(56px,8vw,110px)] text-center">
        <div className={WRAP}>
          <h1
            className="fade-up mx-auto mt-[18px] max-w-[18ch] text-[clamp(40px,6.2vw,76px)] font-bold leading-[1.04] tracking-[-0.035em] [text-wrap:balance]"
            style={{ ["--d" as string]: ".06s" }}
          >
            Shuffle, Ramp, Study, Send.
          </h1>
          <p
            className="fade-up mx-auto mt-5 max-w-[56ch] text-[clamp(16px,1.6vw,19px)] text-muted-foreground [text-wrap:pretty]"
            style={{ ["--d" as string]: ".12s" }}
          >
            Effortlessly track Commander games and unlock in-depth statistics, performance across your pods, key win-con cards, and a lot more. 
          </p>
          <div className="fade-up mt-8 flex flex-wrap justify-center gap-3" style={{ ["--d" as string]: ".18s" }}>
            <button onClick={() => openAuth("signup")} className={cn(BTN, BTN_LG, BTN_PRIMARY)}>
              Track your first game
            </button>
          </div>
        </div>
      </section>

      {/* Hero screenshots */}
      <section className="pb-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <div
            className="fade-up rounded-[22px] border border-border bg-raised p-[clamp(8px,1.2vw,14px)] shadow-[0_24px_80px_hsl(240_8%_8%/0.12)] dark:shadow-[0_24px_80px_hsl(0_0%_0%/0.35)]"
            style={{ ["--d" as string]: ".26s" }}
          >
            <div className="flex items-center gap-1.5 px-1.5 pb-2.5 pt-0.5">
              <i className="h-2.5 w-2.5 rounded-full border border-border bg-muted" />
              <i className="h-2.5 w-2.5 rounded-full border border-border bg-muted" />
              <i className="h-2.5 w-2.5 rounded-full border border-border bg-muted" />
            </div>
            <div className="grid grid-cols-1 gap-[clamp(8px,1.2vw,14px)] sm:grid-cols-2">
              <ScreenshotSlot src={SHOT.heroDashboard} placeholder="Stats dashboard" radius={14} className="aspect-[4/3] w-full" />
              <ScreenshotSlot src={SHOT.heroLive} placeholder="Live game" radius={14} className="aspect-[4/3] w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* At the table */}
      <section id="features" className="border-t border-border py-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <span className={cn(EYEBROW, "mb-3.5 block text-muted-foreground")}>At the table</span>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={cn(CARD, "flex flex-col gap-3.5 p-[26px]")}>
              <ScreenshotSlot src={SHOT.logging} placeholder="Game logging" radius={10} className="aspect-[5/4] w-full" />
              <h3 className="text-[19px] font-semibold tracking-[-0.015em]">Game logging in two taps</h3>
              <p className="text-[14.5px] text-muted-foreground [text-wrap:pretty]">
                Seats, commanders, result — logged before the next shuffle. Your regulars are
                remembered per pod-mate; strangers are found by color identity, so nobody types
                “Yurlok of Scorch Thrash” under pressure.
              </p>
            </div>
            <div className={cn(CARD, "flex flex-col gap-3.5 p-[26px]")}>
              <MiniBoard />
              <h3 className="text-[19px] font-semibold tracking-[-0.015em]">Live game tracking</h3>
              <p className="text-[14.5px] text-muted-foreground [text-wrap:pretty]">
                One phone in the middle of the table tracks all four seats — life, commander damage,
                turn count. Guests install nothing, and every tap quietly becomes a data point for
                the autopsy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The post-game autopsy */}
      <section id="stats" className="border-t border-border bg-[hsl(var(--card)/0.5)] py-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <div className="mb-[clamp(36px,5vw,64px)] max-w-[60ch]">
            <span className={cn(EYEBROW, "mb-3.5 block text-muted-foreground")}>After the game</span>
            <h2 className="text-[clamp(28px,3.6vw,44px)] font-bold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">
              The post-game autopsy
            </h2>
            <p className="mt-3.5 text-[clamp(16px,1.6vw,19px)] text-muted-foreground [text-wrap:pretty]">
              Logging is the chore. This is the payoff — three ledgers deep, from the whole format
              down to the card that won it.
            </p>
          </div>

          <div className="flex flex-col gap-[clamp(40px,6vw,80px)]">
            {STAT_ROWS.map((row, i) => (
              <div
                key={row.kicker}
                className="grid grid-cols-1 items-center gap-[clamp(28px,5vw,72px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
              >
                <div className={cn(i % 2 === 1 && "lg:order-2")}>
                  <span className={EYEBROW}>{row.kicker}</span>
                  <h3 className="mt-3.5 text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-0.02em]">
                    {row.title}
                  </h3>
                  <p className="mt-3 max-w-[46ch] text-[15.5px] text-muted-foreground [text-wrap:pretty]">
                    {row.body}
                  </p>
                </div>
                <div className={cn(CARD, "rounded-[18px] p-[clamp(8px,1vw,12px)]", i % 2 === 1 && "lg:order-1")}>
                  <ScreenshotSlot src={row.src} placeholder={row.placeholder} radius={12} className="aspect-[4/3] w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample stat tiles */}
      <section className="bg-[hsl(var(--card)/0.5)] pb-[clamp(48px,7vw,96px)]">
        <div className={WRAP}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map((tile) => (
              <div key={tile.label} className={cn(CARD, "flex flex-col gap-2 p-[22px]")}>
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {tile.label}
                </span>
                <span className="text-[clamp(30px,3vw,40px)] font-bold leading-[1.05] tracking-[-0.03em] tabular">
                  {tile.value}
                </span>
                <span className="text-[12.5px] text-muted-foreground [text-wrap:pretty]">{tile.sub}</span>
              </div>
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
          <div className="grid grid-cols-1 items-center gap-[clamp(20px,4vw,56px)] rounded-[20px] border border-dashed border-input bg-[hsl(var(--card)/0.4)] p-[clamp(28px,4vw,48px)] md:grid-cols-[minmax(0,1fr)_auto]">
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
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-[clamp(64px,9vw,130px)] text-center">
        <div className={WRAP}>
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
