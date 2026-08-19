import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { capturePageview } from "@/lib/analytics"

/**
 * Sends one `$pageview` per client-side navigation. PostHog's built-in capture
 * only fires on a full document load, which in this SPA means once per session.
 * Guarded against StrictMode's double effect so counts aren't doubled in dev.
 */
export function usePageviews(): void {
  const { pathname } = useLocation()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    capturePageview(pathname)
  }, [pathname])
}
