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

  // Local dev helper: allow loading a test user when a local flag is set.
  useEffect(() => {
    try {
      const hostname = typeof window !== "undefined" ? window.location.hostname : ""
      const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0"
      const isDev = typeof window !== "undefined" && (isLocalHost || import.meta.env.DEV || import.meta.env.MODE !== 'production')
      const devFlag = isDev && typeof window !== "undefined" ? window.localStorage.getItem("dev_auto_sign_in") : null
      if (devFlag === "true") {
        // If there's no real session, inject a lightweight dev user and session for local testing.
        if (!session) {
          const devUser = {
            id: "local-dev-user",
            email: "aayush.iyer+test@gmail.com",
            aud: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
          } as unknown as User

          const devSession = {
            access_token: "dev-token",
            refresh_token: "dev-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
            token_type: "bearer",
            provider_token: null,
            provider_refresh_token: null,
            user: devUser,
          } as unknown as Session

          setUser(devUser)
          setSession(devSession)
          setLoading(false)
        }
      }
    } catch {
      // ignore in non-browser environments
    }
  }, [session])

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
