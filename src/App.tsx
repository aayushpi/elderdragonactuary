import { useState, useEffect, useRef } from "react"
import { Toaster, toast } from "sonner"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { StatsPage } from "@/pages/StatsPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { EditGamePage } from "@/pages/EditGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useGames } from "@/hooks/useGames"
import {
  getCurrentUser,
  pullGamesFromCloud,
  pushGamesToCloud,
  sendMagicLink,
  signOutCloud,
  validateInviteCode,
  markInviteCodeAsUsed,
  storePendingInviteCode,
  getPendingInviteCode,
  clearPendingInviteCode,
} from "@/lib/cloudSync"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import type { AppView, Game } from "@/types"

function App() {
  const [view, setView] = useState<AppView>("dashboard")
  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  const [recentlyEditedGameId, setRecentlyEditedGameId] = useState<string | null>(null)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authEmail, setAuthEmail] = useState("")
  const [authInviteCode, setAuthInviteCode] = useState("")
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const { games, getGame, setGamesState, parseImport } = useGames()
  const mutationInFlightRef = useRef(false)
  const cloudHydratingRef = useRef(false)
  const cloudConfigured = isSupabaseConfigured()

  async function hydrateFromCloudIfSignedIn(silent = true) {
    if (!cloudConfigured || cloudHydratingRef.current) return

    try {
      cloudHydratingRef.current = true
      const user = await getCurrentUser()
      if (!user) return

      const cloud = await pullGamesFromCloud()
      setGamesState(cloud.games)

      if (!silent) {
        toast.success(`Cloud loaded (${cloud.games.length} game${cloud.games.length !== 1 ? "s" : ""}).`)
      }
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Cloud load failed.")
      }
    } finally {
      cloudHydratingRef.current = false
    }
  }

  async function commitGames(nextGames: Game[], opts?: { successToast?: string }) {
    if (mutationInFlightRef.current || cloudHydratingRef.current) {
      toast.error("Cloud sync in progress. Try again in a moment.")
      return false
    }

    const { successToast } = opts ?? {}

    mutationInFlightRef.current = true
    setIsSyncing(true)
    try {
      if (cloudConfigured) {
        const user = await getCurrentUser()
        if (!user) {
          toast.error("Sign in from Settings to save changes.")
          return false
        }
        await pushGamesToCloud(nextGames)
      }

      setGamesState(nextGames)
      if (successToast) {
        toast.success(successToast)
      }
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.")
      return false
    } finally {
      mutationInFlightRef.current = false
      setIsSyncing(false)
    }
  }

  async function handleSaveGame(game: Game) {
    const next = [game, ...games]
    const saved = await commitGames(next, { successToast: "Game logged!" })
    if (saved) {
      setView("dashboard")
    }
  }

  async function handleDeleteGame(id: string) {
    const next = games.filter((g) => g.id !== id)
    await commitGames(next)
  }

  function handleEditGame(id: string) {
    setEditingGameId(id)
    setView("edit-game")
  }

  function handleUpdateGame(game: Game) {
    const next = games.map((g) => (g.id === game.id ? game : g))
    void commitGames(next, { successToast: "Game updated!" }).then((saved) => {
      if (!saved) return
      setEditingGameId(null)
      setRecentlyEditedGameId(game.id)
      setView("history")
    })
  }

  function handleCancelEdit() {
    setEditingGameId(null)
    setView("history")
  }

  async function handleImportGames(json: string) {
    const parsed = parseImport(json)
    if (!parsed.success || !parsed.games) {
      return { success: false, count: 0, error: parsed.error }
    }

    const saved = await commitGames(parsed.games)
    if (!saved) {
      return { success: false, count: 0, error: "Could not save imported games." }
    }

    return { success: true, count: parsed.count }
  }

  async function handleClearGames() {
    return await commitGames([])
  }

  async function handleSendMagicLink() {
    const email = authEmail.trim()
    const code = authInviteCode.trim()

    if (!email || !code) {
      toast.error("Enter both email and invite code.")
      return
    }

    try {
      setAuthBusy(true)

      const isValid = await validateInviteCode(code)
      if (!isValid) {
        toast.error("Invalid or already-used invite code.")
        return
      }

      storePendingInviteCode(code)
      await sendMagicLink(email)
      toast.success("Magic link sent. Check your email.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send magic link.")
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    try {
      setAuthBusy(true)
      await signOutCloud()
      toast.success("Logged out.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log out.")
    } finally {
      setAuthBusy(false)
    }
  }

  useEffect(() => {
    if (!cloudConfigured) {
      setAuthLoading(false)
      return
    }

    let cancelled = false
    const authLoadingTimeout = window.setTimeout(() => {
      if (cancelled) return
      setAuthLoading(false)
      setCurrentUserEmail(null)
      console.warn("Auth hydration timed out; showing sign-in UI.")
    }, 8000)

    const hydrateAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (cancelled) return
        setCurrentUserEmail(user?.email ?? null)
        if (user) {
          await hydrateFromCloudIfSignedIn()
        }
      } catch (error) {
        console.error("Auth hydration error:", error)
      } finally {
        if (!cancelled) {
          setAuthLoading(false)
        }
        window.clearTimeout(authLoadingTimeout)
      }
    }

    void hydrateAuth()

    const supabase = getSupabase()
    const listener = supabase?.auth.onAuthStateChange(async (event, session) => {
      setCurrentUserEmail(session?.user?.email ?? null)

      if (event === "SIGNED_IN") {
        if (session?.user?.id) {
          const pendingCode = getPendingInviteCode()
          if (pendingCode) {
            try {
              await markInviteCodeAsUsed(pendingCode)
              clearPendingInviteCode()
              console.log("Invite code marked as used:", pendingCode)
            } catch (error) {
              const message = error instanceof Error ? error.message : ""
              console.error("Failed to mark invite code as used:", error)
              if (message === "Invite code is invalid or already used.") {
                clearPendingInviteCode()
                toast.error(message)
              } else {
                toast.error("Signed in, but failed to mark invite code as used.")
              }
            }
          }
        }

        void hydrateFromCloudIfSignedIn(false)
      }
      if (event === "SIGNED_OUT") {
        setGamesState([])
        setView("dashboard")
      }
    })

    return () => {
      cancelled = true
      window.clearTimeout(authLoadingTimeout)
      listener?.data.subscription.unsubscribe()
    }
  }, [cloudConfigured])

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-center" richColors />

      {!cloudConfigured ? (
        <main className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-lg border bg-card p-6 space-y-2">
            <h1 className="text-xl font-semibold">Cloud sync not configured</h1>
            <p className="text-sm text-muted-foreground">
              Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to run the app.
            </p>
          </div>
        </main>
      ) : authLoading ? (
        <main className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Checking session…</p>
          </div>
        </main>
      ) : !currentUserEmail ? (
        <main className="container mx-auto max-w-md px-4 py-16">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Welcome to Elder Dragon Actuary</h1>
              <p className="text-sm text-muted-foreground">
                Track Commander games, keep your stats sharp, and sync seamlessly across devices.
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                <li>Fast game logging built for pods and repeat play</li>
                <li>Cloud-first sync so your data follows your account</li>
                <li>Private by default with magic-link sign in</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="INVITE-CODE-HERE"
                value={authInviteCode}
                onChange={(e) => setAuthInviteCode(e.target.value.toUpperCase())}
                disabled={authBusy}
              />
              <Input
                type="email"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                disabled={authBusy}
              />
              <Button className="w-full" onClick={handleSendMagicLink} disabled={authBusy}>
                {authBusy ? "Sending…" : "Send magic link"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">Open the link from your email on this device to continue.</p>
          </div>
        </main>
      ) : (
        <>
          <Nav
            currentView={view}
            onNavigate={setView}
            onShowReleaseNotes={() => setShowReleaseNotes(true)}
            onLogout={handleLogout}
            disableLogout={authBusy || isSyncing}
          />
          <main className="container mx-auto max-w-5xl px-4 py-6">
            {view === "dashboard" && <StatsPage games={games} onNavigate={setView} />}
            {view === "log-game" && (
              <LogGamePage
                onSave={handleSaveGame}
                onCancel={() => setView("dashboard")}
                isSyncing={isSyncing}
              />
            )}
            {view === "edit-game" && editingGameId && getGame(editingGameId) && (
              <EditGamePage
                game={getGame(editingGameId)!}
                onSave={handleUpdateGame}
                onCancel={handleCancelEdit}
              />
            )}
            {view === "history" && (
              <HistoryPage
                games={games}
                onDeleteGame={handleDeleteGame}
                onEditGame={handleEditGame}
                scrollToGameId={recentlyEditedGameId}
                onScrollHandled={() => setRecentlyEditedGameId(null)}
              />
            )}
            {view === "settings" && (
              <SettingsPage onImport={handleImportGames} onClearAll={handleClearGames} />
            )}
          </main>
          <Footer onShowReleaseNotes={() => setShowReleaseNotes(true)} />
          <ReleaseNotesModal open={showReleaseNotes} onOpenChange={setShowReleaseNotes} />
        </>
      )}
    </div>
  )
}

export default App
