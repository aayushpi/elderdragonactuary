import { LayoutDashboard, History, Settings, Plus, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppView } from "@/types"

interface NavProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

const NAV_ITEMS: { view: AppView; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { view: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { view: "history", label: "Game History", Icon: History },
  { view: "settings", label: "Settings", Icon: Settings },
]

export function Nav({ currentView, onNavigate }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 bg-background">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="flex items-center justify-between h-12">
          <span className="font-bold text-sm shrink-0">🔎 Elder Dragon Actuary</span>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Bug className="h-3.5 w-3.5" />
            Report a bug
          </button>
        </div>
        <div className="flex items-center justify-between pb-3">
          <div className="flex gap-1">
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
            New game
            <kbd className="ml-0.5 text-[10px] font-mono bg-white/15 border border-white/25 px-1 py-0.5 rounded leading-none">
              N
            </kbd>
          </Button>
        </div>
      </div>
    </nav>
  )
}
