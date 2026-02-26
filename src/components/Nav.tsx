import { LayoutDashboard, ChartSpline, History, Download, Plus, FileText, Bug, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NavProps {
  currentPath: string
  onNavigate: (path: string) => void
  onOpenLogGame: (commanderName?: string) => void
  onShowReleaseNotes: () => void
  userEmail?: string
  onSignOut?: () => void
}

const NAV_ITEMS: { path: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { path: "/", label: "Dashboard", Icon: LayoutDashboard },
  { path: "/stats", label: "Stats", Icon: ChartSpline },
  { path: "/history", label: "History", Icon: History },
  { path: "/settings", label: "Data", Icon: Download },
]

export function Nav({ currentPath, onNavigate, onOpenLogGame, onShowReleaseNotes, userEmail, onSignOut }: NavProps) {
  function isActivePath(path: string) {
    if (path === "/") return currentPath === "/"
    return currentPath === path || currentPath.startsWith(`${path}/`)
  }

  return (
    <nav className="sticky top-0 z-50 bg-background border-b">
      <div className="container mx-auto max-w-5xl px-4">
        {/* Header row with title */}
        <div className="flex items-center justify-between py-3 gap-2">
          <span className="font-bold text-base sm:text-lg shrink-0 min-w-0">
            <span role="img" aria-label="Search" className="mr-1 sm:mr-2 text-lg sm:text-xl">🔎</span>
            <span className="hidden min-[400px]:inline">Elder Dragon Actuary</span>
            <span className="min-[400px]:hidden">EDA</span>
          </span>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {userEmail && (
              <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[140px]" title={userEmail}>
                {userEmail}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowReleaseNotes}
              className="gap-1 sm:gap-1.5 text-xs h-7 px-1.5 sm:px-2"
              title="Release Notes"
            >
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Release Notes</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('https://github.com/aayushpi/elderdragonactuary/issues/new', '_blank')}
              className="gap-1 sm:gap-1.5 text-xs h-7 px-1.5 sm:px-2"
              title="Report Bug"
            >
              <Bug className="h-3 w-3" />
              <span className="hidden sm:inline">Report Bug</span>
            </Button>
            {onSignOut && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSignOut}
                className="gap-1 sm:gap-1.5 text-xs h-7 px-1.5 sm:px-2"
                title="Sign Out"
              >
                <LogOut className="h-3 w-3" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            )}
          </div>
        </div>

        {/* Navigation row with buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-3 sm:gap-0">
          <div className="flex flex-wrap gap-2">
            {NAV_ITEMS.map(({ path, label, Icon }) => (
              <button
                key={path}
                onClick={() => onNavigate(path)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  isActivePath(path)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {/* hide current route label on mobile */}
                <span
                  className={cn(
                    path === currentPath ? "hidden sm:inline" : ""
                  )}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => onOpenLogGame()} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Track a game</span>
            <span className="sm:hidden">Track Game</span>
            <kbd className="ml-0.5 text-[10px] font-mono bg-white/15 border border-white/25 px-1 py-0.5 rounded leading-none">
              N
            </kbd>
          </Button>
        </div>
      </div>
    </nav>
  )
}
