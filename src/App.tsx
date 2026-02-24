import { useState } from "react"
import { Analytics } from "@vercel/analytics/react"
import { Nav } from "@/components/Nav"
import { DashboardPage } from "@/pages/DashboardPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { useGames } from "@/hooks/useGames"
import type { AppView, Game } from "@/types"

function App() {
  const [view, setView] = useState<AppView>("dashboard")
  const { games, addGame, deleteGame, replaceGames } = useGames()

  function handleSaveGame(game: Game) {
    addGame(game)
    setView("dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav currentView={view} onNavigate={setView} />
      <main className="container mx-auto max-w-3xl px-4 py-6">
        {view === "dashboard" && <DashboardPage games={games} onNavigate={setView} />}
        {view === "log-game" && (
          <LogGamePage
            onSave={handleSaveGame}
            onCancel={() => setView("dashboard")}
          />
        )}
        {view === "history" && (
          <HistoryPage games={games} onDeleteGame={deleteGame} onImport={replaceGames} />
        )}
      </main>
      <Analytics />
    </div>
  )
}

export default App
