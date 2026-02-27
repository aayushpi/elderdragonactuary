import { useEffect, useState, useCallback, type ReactNode } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { AuthContext } from "@/hooks/useAuth"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
      const s = res.data?.session ?? null
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))

    const authResp = supabase.auth.onAuthStateChange((event: string, s: Session | null ) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)

      try {
        // Emit analytics events for sign in / sign up when available
        if (event === 'SIGNED_IN' && s?.user?.id) {
          // lazy import to avoid circular deps
          import('@/lib/analytics').then((mod) => mod.trackUserSignedIn({ user_id: s.user!.id }))
        }
        if (event === 'SIGNED_UP' && s?.user?.id) {
          import('@/lib/analytics').then((mod) => mod.trackUserSignedUp({ user_id: s.user!.id }))
        }
      } catch {
        // ignore analytics errors
      }
    }) as { data?: { subscription?: { unsubscribe: () => void } } } | undefined

    const subscription = authResp?.data?.subscription

    return () => subscription?.unsubscribe?.()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, inviteCode: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          invite_code: inviteCode,
        },
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
