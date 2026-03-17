import { useState, useEffect, useMemo } from "react"
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
import { LiveGamePage } from "@/pages/LiveGamePage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { LoggedOutHomePage } from "@/pages/LoggedOutHomePage"
import { ReleaseNotesModal } from "@/pages/ReleaseNotesPage"
import { useGames } from "@/hooks/useGames"
import { trackGameLogged } from '@/lib/analytics'
import { useAuth } from "@/hooks/useAuth"
import { clearLiveGameSession, loadLiveGameSession } from "@/lib/liveGameStorage"
import type { Game } from "@/types"

type GameFlowMode = "log" | "edit" | "live"

interface GameFlowState {
  mode: GameFlowMode
  minimized: boolean
  editGameId?: string
  prefillCommander?: string
  resumeLiveGame?: boolean
}

type ThemeMode = "light" | "dark" | "system"
type Theme = "light" | "dark"
const LOCAL_LIVE_COMPLETED_KEY_PREFIX = "commando_local_live_completed_games:"

function getLocalLiveCompletedKey(userId: string) {
  return `${LOCAL_LIVE_COMPLETED_KEY_PREFIX}${userId}`
}

function loadLocalLiveCompletedGames(userId: string): Game[] {
  try {
    const raw = localStorage.getItem(getLocalLiveCompletedKey(userId))
    return raw ? (JSON.parse(raw) as Game[]) : []
  } catch {
    return []
  }
}

function saveLocalLiveCompletedGames(userId: string, games: Game[]): void {
  localStorage.setItem(getLocalLiveCompletedKey(userId), JSON.stringify(games))
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [recentlyEditedGameId, setRecentlyEditedGameId] = useState<string | null>(null)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [gameFlow, setGameFlow] = useState<GameFlowState | null>(null)
  const [isLogGameDirty, setIsLogGameDirty] = useState(false)
  const [showDiscardLogDialog, setShowDiscardLogDialog] = useState(false)
  const [hasLiveGame, setHasLiveGame] = useState(false)
  const [localLiveCompletedGames, setLocalLiveCompletedGames] = useState<Game[]>([])
  const [themeMode, setThemeMode] = useState<ThemeMode>("system")
  const [systemTheme, setSystemTheme] = useState<Theme>("light")
  const navigate = useNavigate()
  const location = useLocation()
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, replaceGames, clearGames } = useGames()
  const displayedGames = useMemo(
    () => [...localLiveCompletedGames, ...games].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()),
    [games, localLiveCompletedGames]
  )

  const resolvedTheme: Theme = themeMode === "system" ? systemTheme : themeMode

  const editingGame = gameFlow?.mode === "edit" && gameFlow.editGameId
    ? displayedGames.find((game) => game.id === gameFlow.editGameId)
    : undefined

  function discardInProgressLiveSession() {
    if (!user?.id) return
    if (!loadLiveGameSession(user.id)) return
    clearLiveGameSession(user.id)
    setHasLiveGame(false)
    setGameFlow((prev) => (prev?.mode === "live" ? null : prev))
    toast.message("Discarded in-progress live game.")
  }

  function openLogGameFlow(prefillCommander?: string) {
    discardInProgressLiveSession()
    setIsLogGameDirty(false)
    setGameFlow({ mode: "log", minimized: false, prefillCommander })
  }

  function openEditGameFlow(id: string) {
    setIsLogGameDirty(false)
    setGameFlow({ mode: "edit", minimized: false, editGameId: id })
  }

  function openLiveGameFlow(prefillCommander?: string) {
    discardInProgressLiveSession()
    setIsLogGameDirty(false)
    setGameFlow({ mode: "live", minimized: false, prefillCommander })
  }

  function resumeLiveGameFlow() {
    setIsLogGameDirty(false)
    setGameFlow({ mode: "live", minimized: false, resumeLiveGame: true })
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
    if (!force && (gameFlow?.mode === "log" || gameFlow?.mode === "live") && isLogGameDirty) {
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

  function handleSaveLiveGame(game: Game) {
    if (!user?.id) {
      toast.error("Could not save local live game.")
      return
    }
    const localGame: Game = { ...game, isLocalOnly: true }
    setLocalLiveCompletedGames((prev) => {
      const next = [localGame, ...prev]
      saveLocalLiveCompletedGames(user.id, next)
      return next
    })
    try { trackGameLogged(localGame) } catch { void 0 }
    closeGameFlow(true)
    toast.success("Live game saved locally.")
  }

  function handleUpdateGame(game: Game) {
    void (async () => {
      try {
        const isLocalOnly = localLiveCompletedGames.some((entry) => entry.id === game.id)
        if (isLocalOnly) {
          if (!user?.id) throw new Error("No user")
          setLocalLiveCompletedGames((prev) => {
            const next = prev.map((entry) => (entry.id === game.id ? { ...game, isLocalOnly: true } : entry))
            saveLocalLiveCompletedGames(user.id, next)
            return next
          })
        } else {
          await updateGame(game.id, game)
        }
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

  function handleClearAllGames() {
    if (!user?.id) return
    void clearGames()
    setLocalLiveCompletedGames([])
    saveLocalLiveCompletedGames(user.id, [])
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
    if (!user?.id) {
      setHasLiveGame(false)
      setLocalLiveCompletedGames([])
      return
    }

    setHasLiveGame(Boolean(loadLiveGameSession(user.id)))
    setLocalLiveCompletedGames(loadLocalLiveCompletedGames(user.id))
  }, [user?.id])

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
        onOpenLiveGame={openLiveGameFlow}
        onResumeLiveGame={resumeLiveGameFlow}
        hasLiveGame={hasLiveGame}
        
        onShowReleaseNotes={() => setShowReleaseNotes(true)}
        userEmail={user.email}
        onSignOut={() => {
          void (async () => {
            await signOut()
            navigate("/", { replace: true })
          })()
        }}
      />
      {/* Live game UI removed */}
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
                  games={displayedGames}
                  onNavigate={navigateWithFlowMinimize}
                  onOpenLogGame={openLogGameFlow}
                  onOpenLiveGame={openLiveGameFlow}
                  onResumeLiveGame={resumeLiveGameFlow}
                  hasLiveGame={hasLiveGame}
                  onEditGame={openEditGameFlow}
                />
              }
            />
            <Route
              path="/stats"
              element={
                <StatsPage
                  games={displayedGames}
                  onNavigate={navigateWithFlowMinimize}
                  onOpenLogGame={openLogGameFlow}
                  onOpenLiveGame={openLiveGameFlow}
                  onResumeLiveGame={resumeLiveGameFlow}
                  hasLiveGame={hasLiveGame}
                />
              }
            />
            <Route
              path="/history"
              element={
                <HistoryPage
                  games={displayedGames}
                  onDeleteGame={(id) => {
                    const isLocalOnly = localLiveCompletedGames.some((entry) => entry.id === id)
                    if (isLocalOnly) {
                      setLocalLiveCompletedGames((prev) => {
                        const next = prev.filter((entry) => entry.id !== id)
                        saveLocalLiveCompletedGames(user.id, next)
                        return next
                      })
                      return
                    }
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
              element={<SettingsPage onImport={replaceGames} onClearAll={handleClearAllGames} games={displayedGames} />}
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
          title={gameFlow.mode === "log" ? "Log Game" : gameFlow.mode === "edit" ? "Edit Game" : "Live Game"}
          minimized={gameFlow.minimized}
          onMinimize={minimizeGameFlow}
          onRestore={restoreGameFlow}
          onClose={closeGameFlow}
        >
          {gameFlow.mode === "log" ? (
            <LogGamePage
              games={displayedGames}
              prefillCommander={gameFlow.prefillCommander}
              onSave={handleSaveGame}
              onCancel={handleCancelGameFlow}
              onDirtyChange={setIsLogGameDirty}
            />
          ) : gameFlow.mode === "live" ? (
            <LiveGamePage
              games={displayedGames}
              userId={user.id}
              initialSession={gameFlow.resumeLiveGame ? loadLiveGameSession(user.id) : null}
              prefillCommander={gameFlow.prefillCommander}
              onSave={handleSaveLiveGame}
              onCancel={handleCancelGameFlow}
              onDirtyChange={setIsLogGameDirty}
              onSessionStateChange={setHasLiveGame}
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
