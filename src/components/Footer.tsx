import { Megaphone, Bug } from "lucide-react"

interface FooterProps {
  onShowReleaseNotes: () => void
}

export function Footer({ onShowReleaseNotes }: FooterProps) {
  return (
    <footer className="border-t bg-background mt-12">
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
      </div>
    </footer>
  )
}