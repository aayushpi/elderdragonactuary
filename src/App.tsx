import { useState, useEffect } from "react"
import { Toaster, toast } from "sonner"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { StatsPage } from "@/pages/StatsPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"
import { useGames } from "@/hooks/useGames"
import type { AppView, Game } from "@/types"

function App() {
  const [view, setView] = useState<AppView>("dashboard")
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const { games, addGame, deleteGame, replaceGames, clearGames } = useGames()

  function handleSaveGame(game: Game) {
    addGame(game)
    setView("dashboard")
    toast.success("Game logged!")
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

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-center" richColors />
      <Nav currentView={view} onNavigate={setView} onShowReleaseNotes={() => setShowReleaseNotes(true)} />
      <main className="container mx-auto max-w-3xl px-4 py-6">
        {view === "dashboard" && <StatsPage games={games} onNavigate={setView} />}
        {view === "log-game" && (
          <LogGamePage
            onSave={handleSaveGame}
            onCancel={() => setView("dashboard")}
          />
        )}
        {view === "history" && (
          <HistoryPage games={games} onDeleteGame={deleteGame} />
        )}
        {view === "settings" && (
          <SettingsPage onImport={replaceGames} onClearAll={clearGames} />
        )}
      </main>
      <Footer onShowReleaseNotes={() => setShowReleaseNotes(true)} />
      <ReleaseNotesModal open={showReleaseNotes} onOpenChange={setShowReleaseNotes} />
    </div>
  )
}

export default App
