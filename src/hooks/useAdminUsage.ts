import { useCallback, useEffect, useState } from "react"
import { fetchAdminUsage, type AdminUsage } from "@/lib/adminStats"
import { useIsAdmin } from "@/hooks/useIsAdmin"

interface AdminUsageState {
  isAdmin: boolean | null
  usage: AdminUsage | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/** Loads the per-account roster, but only once the admin check has passed —
 *  a non-admin never issues the usage call at all. */
export function useAdminUsage(): AdminUsageState {
  const isAdmin = useIsAdmin()
  const [usage, setUsage] = useState<AdminUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (isAdmin === null) return

    if (!isAdmin) {
      setUsage(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const next = await fetchAdminUsage()
        if (!cancelled) setUsage(next)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load usage.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAdmin, nonce])

  return { isAdmin, usage, loading, error, refresh }
}
