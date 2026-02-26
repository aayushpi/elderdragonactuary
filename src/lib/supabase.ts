import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

type AuthSession = Session | null

// Minimal, strongly-typed stub for the small subset of Supabase client
// surface the app relies on. This avoids throwing at module import time
// while keeping TypeScript happy in CI when env vars are not provided.
interface PostgrestStub {
  select: (cols?: string) => PostgrestStub
  order: (col: string, opts?: { ascending?: boolean }) => PostgrestStub
  insert: (values: unknown) => PostgrestStub
  update: (values: unknown) => PostgrestStub
  delete: () => PostgrestStub
  eq: (column: string, value: unknown) => PostgrestStub
  single: () => Promise<{ data: unknown | null; error: unknown | null }>
  then?: unknown // allow awaiting the stub directly in some call-sites
}

interface StorageStub {
  from: (bucket: string) => { upload: (...args: unknown[]) => Promise<unknown>; download: (...args: unknown[]) => Promise<unknown> }
}

interface AuthStub {
  getSession: () => Promise<{ data: { session: AuthSession } }>
  getUser?: () => Promise<{ data: { user: { id: string } } }>
  onAuthStateChange: (cb: (event: string, s: AuthSession) => void) => { data: { subscription: { unsubscribe: () => void } } }
  signInWithPassword: (creds: { email: string; password: string }) => Promise<{ error: { message?: string } | null }>
  signUp: (args: unknown) => Promise<{ error: { message?: string } | null }>
  signOut: () => Promise<void>
}

interface MinimalSupabase {
  auth: AuthStub
  from: (table: string) => PostgrestStub
  storage: StorageStub
}

let _supabase: SupabaseClient<Database> | MinimalSupabase

if (supabaseUrl && supabaseAnonKey) {
  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
} else {
  const postgrestFactory = (): PostgrestStub => {
    const stub: Partial<PostgrestStub> = {}
    stub.select = () => stub as PostgrestStub
    stub.order = () => stub as PostgrestStub
    stub.insert = () => stub as PostgrestStub
    stub.update = () => stub as PostgrestStub
    stub.delete = () => stub as PostgrestStub
    stub.eq = () => stub as PostgrestStub
    stub.single = async () => ({ data: null, error: null })
    return stub as PostgrestStub
  }

  _supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: undefined as unknown as { id: string } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ error: { message: 'Supabase not configured' } }),
      signUp: async () => ({ error: { message: 'Supabase not configured' } }),
      signOut: async () => { /* noop */ },
    },
    from: () => postgrestFactory(),
    storage: { from: () => ({ upload: async () => null, download: async () => null }) },
  }
}

export const supabase: SupabaseClient<Database> | MinimalSupabase = _supabase
