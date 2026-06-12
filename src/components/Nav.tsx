import { Plus, Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Wordmark } from "@/components/modern/primitives"

interface NavProps {
  currentPath: string
  onNavigate: (path: string) => void
  onOpenLogGame: (commanderName?: string) => void
  dark: boolean
  onToggleDark: () => void
  onShowReleaseNotes: () => void
  userEmail?: string
  onSignOut?: () => void
}

const NAV_ITEMS: { path: string; label: string }[] = [
  { path: "/", label: "Dashboard" },
  { path: "/stats", label: "Stats" },
  { path: "/history", label: "History" },
  { path: "/settings", label: "Settings" },
]

function isActivePath(currentPath: string, path: string) {
  if (path === "/") return currentPath === "/"
  return currentPath === path || currentPath.startsWith(`${path}/`)
}

export function Nav({ currentPath, onNavigate, onOpenLogGame, dark, onToggleDark }: NavProps) {
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3">
          <button onClick={() => onNavigate("/")} className="min-w-0">
            <Wordmark />
          </button>

          {/* Inline tabs — iPad & up */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ path, label }) => (
              <button
                key={path}
                onClick={() => onNavigate(path)}
                className={cn(
                  "h-9 px-3.5 rounded-md text-sm font-medium transition-colors",
                  isActivePath(currentPath, path)
                    ? "bg-raised text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDark}
              title="Toggle theme"
              className="h-9 w-9 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onOpenLogGame?.()}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm rounded-md font-medium bg-primary text-primary-foreground transition-colors hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Track a game</span>
              <span className="sm:hidden">Track</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
