import { LayoutDashboard, History } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppView } from "@/types"

interface NavProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

const NAV_ITEMS: { view: AppView; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { view: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { view: "history", label: "Game History", Icon: History },
]

export function Nav({ currentView, onNavigate }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="flex items-center h-14 gap-1">
          <span className="font-bold text-sm mr-4 shrink-0">🔎 Elder Dragon Actuary</span>
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
      </div>
    </nav>
  )
}
