import { LayoutDashboard, ChartSpline, History, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { copy } from "@/copy"

interface BottomTabsProps {
  currentPath: string
  onNavigate: (path: string) => void
}

const NAV_ITEMS: { path: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { path: "/", label: copy.nav.dashboard, Icon: LayoutDashboard },
  { path: "/stats", label: copy.nav.stats, Icon: ChartSpline },
  { path: "/history", label: copy.nav.history, Icon: History },
  { path: "/settings", label: copy.nav.settings, Icon: Settings },
]

function isActivePath(currentPath: string, path: string) {
  if (path === "/") return currentPath === "/"
  return currentPath === path || currentPath.startsWith(`${path}/`)
}

export function BottomTabs({ currentPath, onNavigate }: BottomTabsProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <button
            key={path}
            onClick={() => onNavigate(path)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] font-medium transition-colors",
              isActivePath(currentPath, path) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
