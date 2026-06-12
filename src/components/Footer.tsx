import { MessageSquarePlus, Megaphone, Map, HelpCircle } from "lucide-react"
import { isFeaturebaseEnabled, featurebaseUrl } from "@/lib/featurebase"

const FOOTER_LINK =
  "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"

export function Footer() {
  return (
    <footer className="border-t bg-background mt-12">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {isFeaturebaseEnabled() && (
              <>
                <a href={featurebaseUrl("feedback")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Feedback
                </a>
                <a href={featurebaseUrl("changelog")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                  <Megaphone className="h-3.5 w-3.5" />
                  What's new
                </a>
                <a href={featurebaseUrl("roadmap")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                  <Map className="h-3.5 w-3.5" />
                  Roadmap
                </a>
                <a href={featurebaseUrl("help")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                  <HelpCircle className="h-3.5 w-3.5" />
                  Help
                </a>
              </>
            )}
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