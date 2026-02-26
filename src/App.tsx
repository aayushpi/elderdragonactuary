import { useState, useEffect } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom"
import { Toaster, toast } from "sonner"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { StatsPage } from "@/pages/StatsPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { EditGamePage } from "@/pages/EditGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"
import { useGames } from "@/hooks/useGames"
import type { Game } from "@/types"

interface EditGameRouteProps {
  getGame: (id: string) => Game | undefined
  onSave: (game: Game) => void
  onCancel: () => void
}

function EditGameRoute({ getGame, onSave, onCancel }: EditGameRouteProps) {
  const { gameId } = useParams<{ gameId: string }>()

  if (!gameId) {
    return <Navigate to="/history" replace />
  }

  const game = getGame(gameId)
  if (!game) {
    return <Navigate to="/history" replace />
  }

  return <EditGamePage game={game} onSave={onSave} onCancel={onCancel} />
}

function App() {
  const [recentlyEditedGameId, setRecentlyEditedGameId] = useState<string | null>(null)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { games, addGame, updateGame, deleteGame, getGame, replaceGames, clearGames } = useGames()

  function handleSaveGame(game: Game) {
    addGame(game)
    navigate("/")
    toast.success("Game logged!")
  }

  function handleUpdateGame(game: Game) {
    updateGame(game.id, game)
    setRecentlyEditedGameId(game.id)
    navigate("/history")
    toast.success("Game updated!")
  }

  function handleCancelEdit() {
    navigate("/history")
  }

  // Keyboard shortcut: n → log new game (when not focused in a text field)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "n") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if ((e.target as HTMLElement).isContentEditable) return
      navigate("/log-game")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigate])

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-center" richColors />
      <Nav currentPath={location.pathname} onNavigate={navigate} onShowReleaseNotes={() => setShowReleaseNotes(true)} />
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<StatsPage games={games} onNavigate={navigate} />} />
          <Route
            path="/log-game"
            element={<LogGamePage onSave={handleSaveGame} onCancel={() => navigate("/")} />}
          />
          <Route
            path="/history"
            element={(
              <HistoryPage
                games={games}
                onDeleteGame={deleteGame}
                onEditGame={(id) => navigate(`/history/${id}/edit`)}
                scrollToGameId={recentlyEditedGameId}
                onScrollHandled={() => setRecentlyEditedGameId(null)}
              />
            )}
          />
          <Route
            path="/history/:gameId/edit"
            element={<EditGameRoute getGame={getGame} onSave={handleUpdateGame} onCancel={handleCancelEdit} />}
          />
          <Route path="/settings" element={<SettingsPage onImport={replaceGames} onClearAll={clearGames} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer onShowReleaseNotes={() => setShowReleaseNotes(true)} />
      <ReleaseNotesModal open={showReleaseNotes} onOpenChange={setShowReleaseNotes} />
    </div>
  )
}

export default App
