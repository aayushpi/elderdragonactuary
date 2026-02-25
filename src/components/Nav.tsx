import { ChartSpline ,History, Download, Plus, FileText, Bug, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppView } from "@/types"

interface NavProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
  onShowReleaseNotes: () => void
  onLogout: () => void
  disableLogout?: boolean
}

const NAV_ITEMS: { view: AppView; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  // { view: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { view: "dashboard", label: "Stats", Icon: ChartSpline },
  { view: "history", label: "Game History", Icon: History },
  { view: "settings", label: "Data", Icon: Download },
]

export function Nav({ currentView, onNavigate, onShowReleaseNotes, onLogout, disableLogout = false }: NavProps) {
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              disabled={disableLogout}
              className="gap-1 sm:gap-1.5 text-xs h-7 px-1.5 sm:px-2"
              title="Log out"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>

        {/* Navigation row with buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-3 sm:gap-0">
          <div className="flex flex-wrap gap-2">
            {NAV_ITEMS.map(({ view, label, Icon }) => (
              <button
                key={view}
                onClick={() => onNavigate(view)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  currentView === view
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => onNavigate("log-game")} className="gap-1.5 w-full sm:w-auto">
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
