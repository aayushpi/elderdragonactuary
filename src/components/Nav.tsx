import { LayoutDashboard, History, Download, Plus, Bug, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppView } from "@/types"

interface NavProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
  onShowReleaseNotes: () => void
}

const NAV_ITEMS: { view: AppView; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { view: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { view: "history", label: "Game History", Icon: History },
  { view: "settings", label: "Data", Icon: Download },
]

export function Nav({ currentView, onNavigate, onShowReleaseNotes }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 bg-background border-b">
      <div className="container mx-auto max-w-3xl px-4">
        {/* Header row with title and utility links */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2 sm:gap-4">
          <span className="font-bold text-lg shrink-0">
            <span role="img" aria-label="Search" className="mr-2 text-xl">🔎</span>
            <span className="hidden sm:inline">Elder Dragon Actuary</span>
            <span className="sm:hidden">EDA</span>
          </span>
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onShowReleaseNotes()
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Megaphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Release Notes</span>
            </a>
            <a
              href="https://github.com/aayushpi/elderdragonactuary/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bug className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Report a bug</span>
            </a>
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
