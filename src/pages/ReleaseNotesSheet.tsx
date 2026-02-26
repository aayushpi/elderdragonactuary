import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { GameFlowDrawer } from "@/components/GameFlowDrawer"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ReleaseNotesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReleaseNotesSheet({ open, onOpenChange }: ReleaseNotesSheetProps) {
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(false)

  // when opened reset minimized state
  useEffect(() => {
    if (open) setMinimized(false)
  }, [open])

  useEffect(() => {
    if (open) {
      setLoading(true)
      setError(null)

      fetch("/RELEASE_NOTES.md")
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load release notes: ${response.status}`)
          }
          return response.text()
        })
        .then((text) => {
          setContent(text)
          setLoading(false)
        })
        .catch((err) => {
          setError(err.message)
          setLoading(false)
        })
    }
  }, [open])

  return (
    <GameFlowDrawer
      title="What's New"
      minimized={minimized}
      onMinimize={() => setMinimized(true)}
      onRestore={() => setMinimized(false)}
      onClose={() => onOpenChange(false)}
    >
      <div className="max-h-[20vh] overflow-y-auto pr-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading release notes...</div>
          </div>
        )}
        {error && (
          <div className="text-destructive py-4">
            Error loading release notes: {error}
          </div>
        )}
        {content && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold mb-4 text-foreground">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold mb-3 mt-6 text-foreground">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-medium mb-2 mt-4 text-foreground">{children}</h3>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="text-sm">{children}</li>
                ),
                p: ({ children }) => (
                  <p className="mb-3 text-sm text-muted-foreground leading-relaxed">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-muted-foreground">{children}</em>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-primary underline hover:text-primary/80 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="border-border my-6" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </GameFlowDrawer>
  )
}
