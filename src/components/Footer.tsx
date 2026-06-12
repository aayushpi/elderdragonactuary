import { Monitor, Moon, Sun, MessageSquarePlus, Megaphone, Map, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  isFeaturebaseEnabled,
  openFeaturebaseFeedback,
  openFeaturebaseChangelog,
  openFeaturebaseRoadmap,
  openFeaturebaseHelp,
} from "@/lib/featurebase"

const FOOTER_LINK =
  "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"

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
            {isFeaturebaseEnabled() && (
              <>
                <button type="button" onClick={openFeaturebaseFeedback} className={FOOTER_LINK}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Feedback
                </button>
                <button type="button" onClick={openFeaturebaseChangelog} className={FOOTER_LINK}>
                  <Megaphone className="h-3.5 w-3.5" />
                  What's new
                  <span id="fb-update-badge" className="empty:hidden" />
                </button>
                <button type="button" onClick={openFeaturebaseRoadmap} className={FOOTER_LINK}>
                  <Map className="h-3.5 w-3.5" />
                  Roadmap
                </button>
                <button type="button" onClick={openFeaturebaseHelp} className={FOOTER_LINK}>
                  <HelpCircle className="h-3.5 w-3.5" />
                  Help
                </button>
              </>
            )}
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