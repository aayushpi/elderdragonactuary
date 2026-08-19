import { Link } from "react-router-dom"
import { MessageSquarePlus, Megaphone, Map, HelpCircle, LogOut, ShieldCheck } from "lucide-react"
import { isFeaturebaseEnabled, featurebaseUrl } from "@/lib/featurebase"
import { capture } from "@/lib/analytics"
import { useIsAdmin } from "@/hooks/useIsAdmin"

const FOOTER_LINK =
  "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"

interface FooterProps {
  onSignOut?: () => void
}

export function Footer({ onSignOut }: FooterProps) {
  const isAdmin = useIsAdmin()

  return (
    <footer className="border-t bg-background mt-12">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {isFeaturebaseEnabled() && (
              <>
                <a href={featurebaseUrl("feedback")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK} onClick={() => capture("feedback_opened", { surface: "footer", widget: "feedback" })}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Feedback
                </a>
                <a href={featurebaseUrl("changelog")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK} onClick={() => capture("feedback_opened", { surface: "footer", widget: "changelog" })}>
                  <Megaphone className="h-3.5 w-3.5" />
                  What's new
                </a>
                <a href={featurebaseUrl("roadmap")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK} onClick={() => capture("feedback_opened", { surface: "footer", widget: "roadmap" })}>
                  <Map className="h-3.5 w-3.5" />
                  Roadmap
                </a>
                <a href={featurebaseUrl("help")} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK} onClick={() => capture("feedback_opened", { surface: "footer", widget: "help" })}>
                  <HelpCircle className="h-3.5 w-3.5" />
                  Help
                </a>
              </>
            )}
            {isAdmin && (
              <Link to="/admin" className={FOOTER_LINK}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
            {onSignOut && (
              <button type="button" onClick={onSignOut} className={FOOTER_LINK}>
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
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