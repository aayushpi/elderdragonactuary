import { useEffect, useState } from "react"
import { fetchIsAdmin } from "@/lib/adminStats"
import { useAuth } from "@/hooks/useAuth"

/**
 * Whether the signed-in user may see the admin dashboard. Stays `null` until
 * the check resolves, so callers can distinguish "not checked yet" from
 * "checked, not an admin" and avoid flashing UI at a legitimate admin.
 */
export function useIsAdmin(): boolean | null {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setIsAdmin(false)
      return
    }

    let cancelled = false
    void fetchIsAdmin().then((result) => {
      if (!cancelled) setIsAdmin(result)
    })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  return isAdmin
}
