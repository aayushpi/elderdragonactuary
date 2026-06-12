import { useEffect, useState } from "react"
import { ArrowRight, Sun, Moon } from "lucide-react"
import { AuthForm } from "@/components/AuthForm"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Wordmark } from "@/components/modern/primitives"

interface LoggedOutHomePageProps {
  defaultSignInOpen?: boolean
  dark?: boolean
  onToggleDark?: () => void
}

const HERO_STATS: [string, string][] = [
  ["83", "games logged"],
  ["42%", "win rate"],
  ["6", "decks tracked"],
]

export function LoggedOutHomePage({
  defaultSignInOpen = false,
  dark,
  onToggleDark,
}: LoggedOutHomePageProps) {
  const [signInOpen, setSignInOpen] = useState(defaultSignInOpen)

  useEffect(() => {
    setSignInOpen(defaultSignInOpen)
  }, [defaultSignInOpen])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <Wordmark />
            <div className="flex items-center gap-2">
              {onToggleDark && (
                <button
                  onClick={onToggleDark}
                  title="Toggle theme"
                  className="h-9 w-9 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={() => setSignInOpen(true)}
                className="inline-flex items-center justify-center h-9 px-4 text-sm rounded-md font-medium border border-input bg-transparent text-foreground hover:bg-muted transition-colors"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Vanity stats for your very serious commander games
          </p>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Know what wins
            <br />
            in your meta.
          </h1>
          <p
            className="mt-5 max-w-xl text-base sm:text-lg text-muted-foreground"
            style={{ textWrap: "pretty" }}
          >
            Log games in seconds, see trends across commanders, seats, and pods — and walk into your
            next game with the numbers on your side.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => setSignInOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 text-[15px] rounded-md font-medium bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-colors"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 grid grid-cols-3 max-w-xl divide-x divide-border border-y border-border">
          {HERO_STATS.map(([v, l]) => (
            <div key={l} className="py-5 px-4 first:pl-0">
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight tabular">{v}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {l}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="sm:max-w-md">
          <AuthForm onSignedIn={() => setSignInOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
