import { useEffect, useState, useCallback, useRef, type ReactNode } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { AuthContext } from "@/hooks/useAuth"
import { capture, identifyUser, resetIdentity } from "@/lib/analytics"

function identifyFromSession(s: Session | null) {
  if (!s?.user?.id) return
  identifyUser({
    userId: s.user.id,
    email: s.user.email ?? undefined,
    signedUpAt: s.user.created_at ?? undefined,
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Supabase has no SIGNED_UP auth event — a successful signUp also emits
  // SIGNED_IN. Without this the same account counts as both.
  const justSignedUp = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
      const s = res.data?.session ?? null
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
      identifyFromSession(s)
      capture("app_opened", {
        app_env: import.meta.env.MODE,
        is_authenticated: Boolean(s?.user),
        is_standalone:
          typeof window !== "undefined" &&
          window.matchMedia?.("(display-mode: standalone)")?.matches === true,
      })
    }).catch(() => setLoading(false))

    const authResp = supabase.auth.onAuthStateChange((event: string, s: Session | null ) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)

      if (event === "SIGNED_OUT") {
        capture("user_signed_out")
        resetIdentity()
        return
      }

      identifyFromSession(s)

      if (event === "SIGNED_IN") {
        if (justSignedUp.current) {
          justSignedUp.current = false
          return
        }
        capture("user_signed_in", { method: "password" })
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
    capture("signup_started")
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          invite_code: inviteCode,
        },
      },
    })
    if (!error) {
      justSignedUp.current = true
      capture("user_signed_up", { method: "password" })
      return { error: null }
    }

    // Log full error for debugging server-side trigger/database issues
    console.error("signUp error:", error, { email, inviteCode })

    // Supabase/GoTrue wraps trigger exceptions as opaque "Database error" messages.
    // Surface friendlier messages for known cases.
    const msg = error.message ?? ""
    if (/database error/i.test(msg) || /invite code/i.test(msg)) {
      capture("signup_failed", { reason: "invalid_invite_code" })
      return { error: "Signup failed — please double-check your invite code and try again." }
    }
    capture("signup_failed", { reason: "other" })
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
