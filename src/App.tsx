import { useState, useEffect } from "react"
import { Toaster, toast } from "sonner"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { StatsPage } from "@/pages/StatsPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { EditGamePage } from "@/pages/EditGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { AuthPage } from "@/pages/AuthPage"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"
import { useGames } from "@/hooks/useGames"
import { useAuth } from "@/hooks/useAuth"
import type { AppView, Game } from "@/types"
import { Loader2 } from "lucide-react"

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [view, setView] = useState<AppView>("dashboard")
  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  const [recentlyEditedGameId, setRecentlyEditedGameId] = useState<string | null>(null)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, getGame, replaceGames, clearGames } = useGames()

  async function handleSaveGame(game: Game) {
    await addGame(game)
    setView("dashboard")
    toast.success("Game logged!")
  }

  function handleEditGame(id: string) {
    setEditingGameId(id)
    setView("edit-game")
  }

  async function handleUpdateGame(game: Game) {
    await updateGame(game.id, game)
    setEditingGameId(null)
    setRecentlyEditedGameId(game.id)
    setView("history")
    toast.success("Game updated!")
  }

  function handleCancelEdit() {
    setEditingGameId(null)
    setView("history")
  }

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

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-center" richColors />
      <Nav
        currentView={view}
        onNavigate={setView}
        onShowReleaseNotes={() => setShowReleaseNotes(true)}
        userEmail={user.email}
        onSignOut={signOut}
      />
      <main className="container mx-auto max-w-5xl px-4 py-6">
        {gamesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading games…</span>
          </div>
        ) : (
          <>
            {view === "dashboard" && <StatsPage games={games} onNavigate={setView} />}
            {view === "log-game" && (
              <LogGamePage
                onSave={handleSaveGame}
                onCancel={() => setView("dashboard")}
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
                onDeleteGame={deleteGame}
                onEditGame={handleEditGame}
                scrollToGameId={recentlyEditedGameId}
                onScrollHandled={() => setRecentlyEditedGameId(null)}
              />
            )}
            {view === "settings" && (
              <SettingsPage onImport={replaceGames} onClearAll={clearGames} games={games} />
            )}
          </>
        )}
      </main>
      <Footer onShowReleaseNotes={() => setShowReleaseNotes(true)} />
      <ReleaseNotesModal open={showReleaseNotes} onOpenChange={setShowReleaseNotes} />
    </div>
  )
}

export default App
