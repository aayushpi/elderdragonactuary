import { createContext, useContext } from "react"
import type { User, Session } from "@supabase/supabase-js"

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, inviteCode: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Send a password-reset email with a recovery link back to /reset-password. */
  resetPassword: (email: string) => Promise<{ error: string | null }>
  /** Set a new password for the user in an active recovery session. */
  updatePassword: (password: string) => Promise<{ error: string | null }>
  /** True while the user is in a Supabase password-recovery session. */
  recovering: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
