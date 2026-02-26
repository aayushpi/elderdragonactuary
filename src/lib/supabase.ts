import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

type AuthSession = Session | null

interface MinimalSupabase {
  auth: {
    getSession: () => Promise<{ data: { session: AuthSession } }>
    onAuthStateChange: (cb: (event: string, s: AuthSession) => void) => { data: { subscription: { unsubscribe: () => void } } }
    signInWithPassword: (creds: { email: string; password: string }) => Promise<{ error: { message?: string } | null }>
    signUp: (args: unknown) => Promise<{ error: { message?: string } | null }>
    signOut: () => Promise<void>
  }
  from: (table: string) => { select: () => void; insert: () => void; update: () => void; delete: () => void }
  storage: { from: (b: string) => { upload: () => void; download: () => void } }
}

let _supabase: SupabaseClient<Database> | MinimalSupabase

if (supabaseUrl && supabaseAnonKey) {
  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
} else {
  const makeThrower = (name: string) => () => {
    throw new Error(
      `Supabase not configured: ${name} called but VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.`
    )
  }

  _supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (cb: (event: string, s: AuthSession) => void) => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async (_creds: { email: string; password: string }) => ({ error: { message: 'Supabase not configured' } }),
      signUp: async (_args: unknown) => ({ error: { message: 'Supabase not configured' } }),
      signOut: async () => { throw new Error('Supabase not configured') },
    },
    from: () => ({ select: () => {}, insert: () => {}, update: () => {}, delete: () => {} }),
    storage: { from: () => ({ upload: () => {}, download: () => {} }) },
  }
}

export const supabase: SupabaseClient<Database> | MinimalSupabase = _supabase
