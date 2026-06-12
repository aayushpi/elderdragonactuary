import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

type ThemeMode = "light" | "dark" | "system"
type Theme = "light" | "dark"

interface FooterProps {
  themeMode: ThemeMode
  resolvedTheme: Theme
  onToggleTheme: () => void
}

export function Footer({ themeMode, resolvedTheme, onToggleTheme }: FooterProps) {
  const themeTitle =
    themeMode === "light"
      ? "Theme: Light (click for Dark)"
      : themeMode === "dark"
        ? "Theme: Dark (click for System)"
        : `Theme: System (${resolvedTheme}) (click for Light)`

  const themeLabel =
    themeMode === "light"
      ? "Light"
      : themeMode === "dark"
        ? "Dark"
        : "System"

  const ThemeIcon = themeMode === "system" ? Monitor : themeMode === "dark" ? Sun : Moon

  return (
    <footer className="border-t bg-background mt-12">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTheme}
              className="gap-1 text-xs h-7 px-2"
              title={themeTitle}
            >
              <ThemeIcon className="h-3.5 w-3.5" />
              <span>{themeLabel}</span>
            </Button>
          </div>

          <a
            href="https://aayush.fyi/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Made by Aayush
          </a>

        </div>
      </div>
    </footer>
  )
}