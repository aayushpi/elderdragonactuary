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
      // Identify returning users (existing session) so email is set for
      // feature-flag targeting, not just on an active sign-in.
      if (s?.user?.id) {
        import('@/lib/analytics').then((mod) =>
          mod.identifyUser({ user_id: s.user!.id, email: s.user!.email ?? undefined })
        )
      }
    }).catch(() => setLoading(false))

    const authResp = supabase.auth.onAuthStateChange((event: string, s: Session | null ) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)

      try {
        if (s?.user?.id) {
          const id = s.user.id
          const email = s.user.email ?? undefined
          import('@/lib/analytics').then((mod) => {
            // Always keep identity + email current (covers INITIAL_SESSION, token refresh)
            mod.identifyUser({ user_id: id, email })
            if (event === 'SIGNED_IN') mod.trackUserSignedIn({ user_id: id, email })
            if (event === 'SIGNED_UP') mod.trackUserSignedUp({ user_id: id, email })
          })
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
    if (!error) return { error: null }

    // Log full error for debugging server-side trigger/database issues
    console.error("signUp error:", error, { email, inviteCode })

    // Supabase/GoTrue wraps trigger exceptions as opaque "Database error" messages.
    // Surface friendlier messages for known cases.
    const msg = error.message ?? ""
    if (/database error/i.test(msg)) {
      return { error: "Signup failed — please double-check your invite code and try again." }
    }
    return { error: msg }
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
