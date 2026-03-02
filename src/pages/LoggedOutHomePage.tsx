import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { AuthForm } from "@/components/AuthForm"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"

interface LoggedOutHomePageProps {
  defaultSignInOpen?: boolean
}


export function LoggedOutHomePage({ defaultSignInOpen = false }: LoggedOutHomePageProps) {
  const [signInOpen, setSignInOpen] = useState(defaultSignInOpen)
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false)

  useEffect(() => {
    setSignInOpen(defaultSignInOpen)
  }, [defaultSignInOpen])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <main className="space-y-8">
          <section className="rounded-2xl border bg-gradient-to-b from-background to-muted/20 p-8 sm:p-12">
            <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs text-muted-foreground">
              Vanity stats for your very very serious commander games
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              EDH Actuary
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Log games, analyze trends, and quickly understand what wins in your meta.
              Fast to use, clean to read, and centered on your next game decision.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="gap-2" onClick={() => setSignInOpen(true)}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => setSignInOpen(true)}>
                Sign in
              </Button>
              <Button size="lg" variant="outline" onClick={() => setReleaseNotesOpen(true)}>
                View release notes
              </Button>
            </div>
          </section>

          
        </main>
      </div>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="sm:max-w-md">
          <AuthForm onSignedIn={() => setSignInOpen(false)} />
        </DialogContent>
      </Dialog>

      <ReleaseNotesModal open={releaseNotesOpen} onOpenChange={setReleaseNotesOpen} />
    </div>
  )
}
