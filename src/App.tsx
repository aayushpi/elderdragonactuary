import { useState, useEffect, useRef } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { Toaster, toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Nav } from "@/components/Nav"
import { BottomTabs } from "@/components/BottomTabs"
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
import { PrototypesPage } from "@/pages/PrototypesPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { LoggedOutHomePage } from "@/pages/LoggedOutHomePage"
import { LiveGamePage } from "@/pages/LiveGamePage"
import { AdminPage } from "@/pages/AdminPage"
import { useGames } from "@/hooks/useGames"
import { type AccentName, loadAccent, saveAccent, applyAccent } from "@/lib/accent"
import { capture, setPersonProperties } from "@/lib/analytics"
import { gameShapeProps } from "@/lib/analytics/gameProps"
import type { LogEntryPoint } from "@/lib/analytics/events"
import { usePageviews } from "@/hooks/usePageviews"
import { useAuth } from "@/hooks/useAuth"
import { OnboardingTour } from "@/components/onboarding/OnboardingTour"
import { shouldShowOnboarding, saveOnboarding, type OnboardingStatus } from "@/lib/onboarding"
import type { Game } from "@/types"

type GameFlowMode = "log" | "edit"

interface GameFlowState {
  mode: GameFlowMode
  minimized: boolean
  editGameId?: string
  prefillCommander?: string
}

type ThemeMode = "light" | "dark" | "system"
type Theme = "light" | "dark"

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [recentlyEditedGameId, setRecentlyEditedGameId] = useState<string | null>(null)
  const [gameFlow, setGameFlow] = useState<GameFlowState | null>(null)
  const [isLogGameDirty, setIsLogGameDirty] = useState(false)
  const [showDiscardLogDialog, setShowDiscardLogDialog] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>("system")
  const [tourOrigin, setTourOrigin] = useState<string | null>(null)
  const [accent, setAccentState] = useState<AccentName>(() => loadAccent())
  const [systemTheme, setSystemTheme] = useState<Theme>("light")
  const navigate = useNavigate()
  const location = useLocation()
  const { games, loading: gamesLoading, addGame, updateGame, deleteGame, getGame, replaceGames, clearGames } = useGames()

  usePageviews()

  // Mirror the account's game totals onto the PostHog person so cohorts like
  // "logged 10+ games" are a property filter rather than an event roll-up.
  // Keyed on a signature so a re-render with the same totals sends nothing.
  const lastPersonSignature = useRef<string | null>(null)
  useEffect(() => {
    if (gamesLoading || !user) return
    const lastPlayedAt = games.reduce<string | null>(
      (latest, g) => (!latest || g.playedAt > latest ? g.playedAt : latest),
      null,
    )
    const signature = `${games.length}:${lastPlayedAt ?? ""}`
    if (lastPersonSignature.current === signature) return
    lastPersonSignature.current = signature
    setPersonProperties({ games_logged: games.length, last_game_at: lastPlayedAt })
  }, [games, gamesLoading, user])

  const resolvedTheme: Theme = themeMode === "system" ? systemTheme : themeMode

  const editingGame = gameFlow?.mode === "edit" && gameFlow.editGameId
    ? getGame(gameFlow.editGameId)
    : undefined

  function openLogGameFlow(prefillCommander?: string, entryPoint: LogEntryPoint = "nav") {
    setIsLogGameDirty(false)
    capture("game_log_started", { entry_point: entryPoint, prefilled: Boolean(prefillCommander) })
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

  function closeGameFlow(force = false, saved = false) {
    if (!force && gameFlow?.mode === "log" && isLogGameDirty) {
      setShowDiscardLogDialog(true)
      return
    }

    // `saved` matters: the save path also closes the flow, and counting that
    // as an abandon would make the abandonment metric meaningless.
    if (!saved && gameFlow?.mode === "log") {
      capture("game_log_abandoned", { had_unsaved_changes: isLogGameDirty })
    }

    setShowDiscardLogDialog(false)
    setIsLogGameDirty(false)
    setGameFlow(null)
  }

  function confirmDiscardLogGame() {
    closeGameFlow(true)
  }

  // The walkthrough opens and closes the log drawer itself. It deliberately
  // bypasses openLogGameFlow/closeGameFlow so a demonstration never shows up
  // in the logging funnel as a started-then-abandoned game.
  const tourOpenedLog = useRef(false)

  function openLogGameForTour() {
    setGameFlow((prev) => {
      if (prev) return prev
      tourOpenedLog.current = true
      return { mode: "log", minimized: false }
    })
  }

  function closeLogGameForTour() {
    if (!tourOpenedLog.current) return
    tourOpenedLog.current = false
    setIsLogGameDirty(false)
    setGameFlow(null)
  }

  function startTour(source: "auto" | "settings") {
    capture("onboarding_started", { source })
    setTourOrigin(location.pathname)
  }

  function finishTour(status: OnboardingStatus) {
    saveOnboarding(status)
    closeLogGameForTour()
    const origin = tourOrigin ?? "/"
    setTourOrigin(null)
    if (location.pathname !== origin) navigate(origin)
  }

  function setAccent(next: AccentName) {
    setAccentState(next)
    saveAccent(next)
  }

  function handleSaveGame(game: Game) {
    void (async () => {
      try {
        await addGame(game)
        capture("game_logged", gameShapeProps(game))
        closeGameFlow(true, true)
        toast.success("Game logged!")
      } catch {
        // Errors are surfaced in useGames
      }
    })()
  }

  async function handleSaveLiveGame(game: Game) {
    await addGame(game)
    capture("game_logged", gameShapeProps(game))
    capture("live_game_completed", { pod_size: game.players.length, win_turn: game.winTurn })
    setRecentlyEditedGameId(game.id)
    navigate("/history")
  }

  function handleUpdateGame(game: Game) {
    void (async () => {
      try {
        await updateGame(game.id, game)
        capture("game_updated", { pod_size: game.players.length })
        setRecentlyEditedGameId(game.id)
        closeGameFlow(true, true)
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

  // Every player gets the walkthrough once — new signups and existing
  // accounts alike — as soon as their games have loaded.
  const autoTourChecked = useRef(false)
  useEffect(() => {
    if (!user || gamesLoading || autoTourChecked.current) return
    autoTourChecked.current = true
    if (!shouldShowOnboarding()) return
    startTour("auto")
    // startTour reads location.pathname once, as the tour opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, gamesLoading])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "n") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if ((e.target as HTMLElement).isContentEditable) return
      openLogGameFlow(undefined, "keyboard_shortcut")
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
    applyAccent(accent, resolvedTheme === "dark")
    localStorage.setItem("theme-mode", themeMode)
  }, [resolvedTheme, themeMode, accent])

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
        <Route path="/" element={<LoggedOutHomePage />} />
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
        onOpenLogGame={(name) => openLogGameFlow(name, "nav")}
        onStartLive={() => {
          capture("live_game_started")
          navigateWithFlowMinimize("/live")
        }}
        userEmail={user.email}
        onSignOut={() => {
          void (async () => {
            await signOut()
            navigate("/", { replace: true })
          })()
        }}
      />
      <main className="container mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">
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
                  onOpenLogGame={(name) =>
                    openLogGameFlow(name, name ? "commander_card" : "dashboard")
                  }
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
                  onOpenLogGame={(name) => openLogGameFlow(name, "stats")}
                />
              }
            />
            <Route
              path="/history"
              element={
                <HistoryPage
                  games={games}
                  onDeleteGame={(id) => {
                    capture("game_deleted", { surface: "history" })
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
              element={
                <SettingsPage
                  onImport={replaceGames}
                  onClearAll={clearGames}
                  games={games}
                  themeMode={themeMode}
                  onSetThemeMode={setThemeMode}
                  accent={accent}
                  onSetAccent={setAccent}
                  userEmail={user.email}
                  onReplayTour={() => startTour("settings")}
                  onSignOut={() => {
                    void (async () => {
                      await signOut()
                      navigate("/", { replace: true })
                    })()
                  }}
                />
              }
            />
            <Route
              path="/live"
              element={
                <LiveGamePage
                  games={games}
                  onSaveGame={handleSaveLiveGame}
                  onExit={() => {
                    capture("live_game_abandoned")
                    navigate("/")
                  }}
                />
              }
            />
            <Route
              path="/prototypes/history"
              element={
                <PrototypesPage
                  games={games}
                  onEditGame={openEditGameFlow}
                  onDeleteGame={(id) => {
                    void deleteGame(id)
                  }}
                />
              }
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      <BottomTabs currentPath={location.pathname} onNavigate={navigateWithFlowMinimize} />
      <Footer
        onSignOut={() => {
          void (async () => {
            await signOut()
            navigate("/", { replace: true })
          })()
        }}
      />

      <AlertDialog open={showDiscardLogDialog} onOpenChange={setShowDiscardLogDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard in-progress game log?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in Log Game. Closing now will lose your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscardLogGame}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OnboardingTour
        open={tourOrigin !== null}
        onNavigate={(path) => navigate(path)}
        onOpenLogGame={openLogGameForTour}
        onCloseLogGame={closeLogGameForTour}
        onFinish={finishTour}
      />

      {gameFlow && (
        <GameFlowDrawer
          title={gameFlow.mode === "log" ? "Log Game" : "Edit Game"}
          minimized={gameFlow.minimized}
          onMinimize={minimizeGameFlow}
          onRestore={restoreGameFlow}
          onClose={closeGameFlow}
          onDelete={gameFlow.mode === "edit" && editingGame ? () => { capture("game_deleted", { surface: "edit_drawer" }); void deleteGame(editingGame.id); closeGameFlow() } : undefined}
        >
          {gameFlow.mode === "log" ? (
            <LogGamePage
              prefillCommander={gameFlow.prefillCommander}
              onSave={handleSaveGame}
              onCancel={handleCancelGameFlow}
              onDirtyChange={setIsLogGameDirty}
            />
          ) : (
            editingGame && (
              <EditGamePage
                game={editingGame}
                onSave={handleUpdateGame}
                onCancel={handleCancelGameFlow}
                onDelete={() => {
                  capture("game_deleted", { surface: "edit_drawer" })
                  void deleteGame(editingGame.id)
                  closeGameFlow()
                }}
              />
            )
          )}
        </GameFlowDrawer>
      )}
    </div>
  )
}

export default App
