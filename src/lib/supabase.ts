import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Avoid throwing at module import time so CI/builds without env vars don't fail.
// If the vars are missing, export a stub that will throw useful errors when used at runtime.
if (!supabaseUrl || !supabaseAnonKey) {
  // lightweight runtime stub that throws when any method is invoked
  const makeThrower = (name: string) => () => {
    throw new Error(
      `Supabase not configured: ${name} called but VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.`
    )
  }

  // Minimal stub surface used across the app (auth, from, storage). Add more methods if needed.
  const stub: any = {
    auth: {
      getSession: makeThrower('auth.getSession'),
      onAuthStateChange: makeThrower('auth.onAuthStateChange'),
      signInWithPassword: makeThrower('auth.signInWithPassword'),
      signUp: makeThrower('auth.signUp'),
      signOut: makeThrower('auth.signOut'),
    },
    from: () => ({ select: makeThrower('from(...).select'), insert: makeThrower('from(...).insert'), update: makeThrower('from(...).update'), delete: makeThrower('from(...).delete') }),
    storage: { from: () => ({ upload: makeThrower('storage.from(...).upload'), download: makeThrower('storage.from(...).download') }) },
  }

  // export as any to satisfy callers; runtime use will surface clear error messages
  export const supabase: any = stub
} else {
  export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
}
