import { useState, useEffect } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { Toaster, toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { GameFlowDrawer } from "@/components/GameFlowDrawer"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DashboardPage } from "@/pages/DashboardPage"
import { StatsPage } from "@/pages/StatsPage"
import { LogGamePage } from "@/pages/LogGamePage"
import { EditGamePage } from "@/pages/EditGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { LoggedOutHomePage } from "@/pages/LoggedOutHomePage"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"
import { TrackGamePage } from "@/pages/TrackGamePage"
import { LiveCountPicker } from "@/components/live/LiveCountPicker"
import { LiveAnnouncementModal, hasSeenLiveAnnouncement } from "@/components/LiveAnnouncementModal"
import { useGames } from "@/hooks/useGames"
import { trackGameLogged } from '@/lib/analytics'
import { useAuth } from "@/hooks/useAuth"
import type { Game, Player } from "@/types"

type GameFlowMode = "log" | "edit"

interface LivePrefillResult {
  players: Partial<Player>[]
  winTurn: number
  winnerId?: string
}

interface GameFlowState {
  mode: GameFlowMode
  minimized: boolean
  editGameId?: string
  prefillCommander?: string
  prefillLiveResult?: LivePrefillResult
}

type ThemeMode = "light" | "dark" | "system"
type Theme = "light" | "dark"

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [recentlyEditedGameId, setRecentlyEditedGameId] = useState<string | null>(null)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [gameFlow, setGameFlow] = useState<GameFlowState | null>(null)
  const [isLogGameDirty, setIsLogGameDirty] = useState(false)
  const [showDiscardLogDialog, setShowDiscardLogDialog] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>("system")
  const [liveGamePlayers, setLiveGamePlayers] = useState<Partial<Player>[] | null>(null)
  const [showLiveCountPicker, setShowLiveCountPicker] = useState(false)
  const [showLiveAnnouncement, setShowLiveAnnouncement] = useState(() => !hasSeenLiveAnnouncement())
  const [systemTheme, setSystemTheme] = useState<Theme>("light")
  const navigate = useNavigate()
  const location = useLocation()
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, getGame, replaceGames, clearGames } = useGames()

  const resolvedTheme: Theme = themeMode === "system" ? systemTheme : themeMode

  const editingGame = gameFlow?.mode === "edit" && gameFlow.editGameId
    ? getGame(gameFlow.editGameId)
    : undefined

  function openLiveGame(players: Partial<Player>[]) {
    setLiveGamePlayers(players)
    setGameFlow(null)
    setShowLiveCountPicker(false)
  }

  function handleLiveCountSelected(count: number) {
    const players: Partial<Player>[] = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      seatPosition: (i + 1) as Player["seatPosition"],
      commanderName: `Player ${i + 1}`,
      isMe: i === 0,
    }))
    openLiveGame(players)
  }

  function closeLiveGame(result?: { winTurn: number; knockoutTurns: Record<string, number>; winnerId?: string }) {
    const savedPlayers = liveGamePlayers
    setLiveGamePlayers(null)

    if (result && savedPlayers) {
      // Reopen the log-game drawer pre-populated with the live session data
      const updatedPlayers = savedPlayers.map((p) => ({
        ...p,
        knockoutTurn: p.id && result.knockoutTurns[p.id] ? result.knockoutTurns[p.id] : p.knockoutTurn,
      }))
      setIsLogGameDirty(false)
      setGameFlow({
        mode: "log",
        minimized: false,
        prefillCommander: updatedPlayers.find((p) => p.isMe)?.commanderName,
        prefillLiveResult: {
          players: updatedPlayers,
          winTurn: result.winTurn,
          winnerId: result.winnerId,
        },
      })
    }
  }

  function openLogGameFlow(prefillCommander?: string) {
    setIsLogGameDirty(false)
    setGameFlow({ mode: "log", minimized: false, prefillCommander })
  }

  function openEditGameFlow(id: string) {
    setIsLogGameDirty(false)
    setGameFlow({ mode: "edit", minimized: false, editGameId: id })
  }

  function navigateWithFlowMinimize(path: string) {
    setGameFlow((prev) => (prev && !prev.minimized ? { ...prev, minimized: true } : prev))
    navigate(path)
  }

  function minimizeGameFlow() {
    setGameFlow((prev) => (prev ? { ...prev, minimized: true } : prev))
  }

  function restoreGameFlow() {
    setGameFlow((prev) => (prev ? { ...prev, minimized: false } : prev))
  }

  function closeGameFlow(force = false) {
    if (!force && gameFlow?.mode === "log" && isLogGameDirty) {
      setShowDiscardLogDialog(true)
      return
    }

    setShowDiscardLogDialog(false)
    setIsLogGameDirty(false)
    setGameFlow(null)
  }

  function confirmDiscardLogGame() {
    closeGameFlow(true)
  }

  function toggleTheme() {
    setThemeMode((prev) => {
      if (prev === "light") return "dark"
      if (prev === "dark") return "system"
      return "light"
    })
  }

  function handleSaveGame(game: Game) {
    void (async () => {
      try {
        await addGame(game)
        try { trackGameLogged(game) } catch { void 0 }
        closeGameFlow(true)
        toast.success("Game logged!")
      } catch {
        // Errors are surfaced in useGames
      }
    })()
  }

  function handleUpdateGame(game: Game) {
    void (async () => {
      try {
        await updateGame(game.id, game)
        setRecentlyEditedGameId(game.id)
        closeGameFlow(true)
        navigate("/history")
        toast.success("Game updated!")
      } catch {
        // Errors are surfaced in useGames
      }
    })()
  }

  function handleCancelGameFlow() {
    closeGameFlow()
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "n") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if ((e.target as HTMLElement).isContentEditable) return
      setIsLogGameDirty(false)
      setGameFlow({ mode: "log", minimized: false })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (gameFlow?.mode !== "edit" || !gameFlow.editGameId) return
    if (editingGame) return

    setGameFlow(null)
    toast.error("Could not find that game to edit.")
  }, [gameFlow, editingGame])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const applySystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light")

    applySystemTheme()
    mediaQuery.addEventListener("change", applySystemTheme)
    return () => mediaQuery.removeEventListener("change", applySystemTheme)
  }, [])

  useEffect(() => {
    const storedMode = localStorage.getItem("theme-mode")
    if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
      setThemeMode(storedMode)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
    localStorage.setItem("theme-mode", themeMode)
  }, [resolvedTheme, themeMode])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route
          path="/"
          element={<LoggedOutHomePage />}
        />
        <Route path="/auth" element={<LoggedOutHomePage defaultSignInOpen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-center" richColors />
      <Nav
        currentPath={location.pathname}
        onNavigate={navigateWithFlowMinimize}
        onOpenLogGame={openLogGameFlow}
        onStartLiveGame={() => setShowLiveCountPicker(true)}
        onShowReleaseNotes={() => setShowReleaseNotes(true)}
        userEmail={user.email}
        onSignOut={() => {
          void (async () => {
            await signOut()
            navigate("/", { replace: true })
          })()
        }}
      />
      {/* Live game tracker overlay */}
      {liveGamePlayers && (
        <TrackGamePage
          players={liveGamePlayers}
          onExit={closeLiveGame}
          onRematch={(rematchPlayers) => {
            setLiveGamePlayers(null)
            setTimeout(() => setLiveGamePlayers(rematchPlayers), 50)
          }}
        />
      )}

      {/* Live count picker */}
      {showLiveCountPicker && !liveGamePlayers && (
        <LiveCountPicker
          onSelect={handleLiveCountSelected}
          onCancel={() => setShowLiveCountPicker(false)}
        />
      )}
      <main className="container mx-auto max-w-5xl px-4 py-6">
        {gamesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading games…</span>
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  games={games}
                  onNavigate={navigateWithFlowMinimize}
                  onOpenLogGame={openLogGameFlow}
                  onEditGame={openEditGameFlow}
                />
              }
            />
            <Route
              path="/stats"
              element={
                <StatsPage
                  games={games}
                  onNavigate={navigateWithFlowMinimize}
                  onOpenLogGame={openLogGameFlow}
                />
              }
            />
            <Route
              path="/history"
              element={
                <HistoryPage
                  games={games}
                  onDeleteGame={(id) => {
                    void deleteGame(id)
                  }}
                  onEditGame={openEditGameFlow}
                  scrollToGameId={recentlyEditedGameId}
                  onScrollHandled={() => setRecentlyEditedGameId(null)}
                />
              }
            />
            <Route
              path="/settings"
              element={<SettingsPage onImport={replaceGames} onClearAll={clearGames} games={games} />}
            />
            {/* Map page removed */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      <Footer
        onShowReleaseNotes={() => setShowReleaseNotes(true)}
        themeMode={themeMode}
        resolvedTheme={resolvedTheme}
        onToggleTheme={toggleTheme}
      />
      <ReleaseNotesModal open={showReleaseNotes} onOpenChange={setShowReleaseNotes} />
      <LiveAnnouncementModal open={showLiveAnnouncement} onClose={() => setShowLiveAnnouncement(false)} />

      <AlertDialog open={showDiscardLogDialog} onOpenChange={setShowDiscardLogDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard in-progress game log?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in Track Game. Closing now will lose your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscardLogGame}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {gameFlow && (
        <GameFlowDrawer
          title={gameFlow.mode === "log" ? "Log Game" : "Edit Game"}
          minimized={gameFlow.minimized}
          onMinimize={minimizeGameFlow}
          onRestore={restoreGameFlow}
          onClose={closeGameFlow}
        >
          {gameFlow.mode === "log" ? (
            <LogGamePage
              prefillCommander={gameFlow.prefillCommander}
              prefillLiveResult={gameFlow.prefillLiveResult}
              onSave={handleSaveGame}
              onCancel={handleCancelGameFlow}
              onDirtyChange={setIsLogGameDirty}
              onTrackLive={openLiveGame}
            />
          ) : (
            editingGame && (
              <EditGamePage
                game={editingGame}
                onSave={handleUpdateGame}
                onCancel={handleCancelGameFlow}
              />
            )
          )}
        </GameFlowDrawer>
      )}
    </div>
  )
}

export default App
