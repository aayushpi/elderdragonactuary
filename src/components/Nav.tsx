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
    <nav className="sticky top-0 z-50 bg-background">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="flex items-center justify-between py-3 mb-4">
          <span className="font-bold text-lg shrink-0">
            <span role="img" aria-label="Search" className="mr-2 text-xl">🔎</span>
            Elder Dragon Actuary
          </span>
          <div className="flex items-center gap-4">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onShowReleaseNotes()
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Release Notes
            </a>
            <a
              href="https://github.com/aayushpi/elderdragonactuary/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bug className="h-3.5 w-3.5" />
              Report a bug
            </a>
          </div>
        </div>
        <div className="flex items-center justify-between pb-3">
          <div className="flex gap-2">
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
          <Button size="sm" onClick={() => onNavigate("log-game")} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Track a game
            <kbd className="ml-0.5 text-[10px] font-mono bg-white/15 border border-white/25 px-1 py-0.5 rounded leading-none">
              N
            </kbd>
          </Button>
        </div>
      </div>
    </nav>
  )
}
