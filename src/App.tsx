import { useState, useEffect, useRef } from "react"
import { Toaster, toast } from "sonner"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { StatsPage } from "@/pages/StatsPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"
import { useGames } from "@/hooks/useGames"
import { getCurrentUser, pullGamesFromCloud, pushGamesToCloud } from "@/lib/cloudSync"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import type { AppView, Game } from "@/types"

function App() {
  const [view, setView] = useState<AppView>("dashboard")
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const { games, setGamesState, parseImport } = useGames()
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

  useEffect(() => {
    void hydrateFromCloudIfSignedIn()

    const supabase = getSupabase()
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void hydrateFromCloudIfSignedIn(false)
      }
      if (event === "SIGNED_OUT") {
        setGamesState([])
      }
    })

    return () => {
      listener?.data.subscription.unsubscribe()
    }
  }, [])

  // Keyboard shortcut: n → log new game (when not focused in a text field)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "n") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if ((e.target as HTMLElement).isContentEditable) return
      setView("log-game")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-center" richColors />
      <Nav currentView={view} onNavigate={setView} onShowReleaseNotes={() => setShowReleaseNotes(true)} />
      <main className="container mx-auto max-w-5xl px-4 py-6">
        {view === "dashboard" && <StatsPage games={games} onNavigate={setView} />}
        {view === "log-game" && (
          <LogGamePage
            onSave={handleSaveGame}
            onCancel={() => setView("dashboard")}
            isSyncing={isSyncing}
          />
        )}
        {view === "history" && (
          <HistoryPage games={games} onDeleteGame={handleDeleteGame} isSyncing={isSyncing} />
        )}
        {view === "settings" && (
          <SettingsPage onImport={handleImportGames} onClearAll={handleClearGames} />
        )}
      </main>
      <Footer onShowReleaseNotes={() => setShowReleaseNotes(true)} />
      <ReleaseNotesModal open={showReleaseNotes} onOpenChange={setShowReleaseNotes} />
    </div>
  )
}

export default App
