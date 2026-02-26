import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let _supabase: any

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
      getSession: makeThrower('auth.getSession'),
      onAuthStateChange: makeThrower('auth.onAuthStateChange'),
      signInWithPassword: makeThrower('auth.signInWithPassword'),
      signUp: makeThrower('auth.signUp'),
      signOut: makeThrower('auth.signOut'),
    },
    from: () => ({ select: makeThrower('from(...).select'), insert: makeThrower('from(...).insert'), update: makeThrower('from(...).update'), delete: makeThrower('from(...).delete') }),
    storage: { from: () => ({ upload: makeThrower('storage.from(...).upload'), download: makeThrower('storage.from(...).download') }) },
  }
}

export const supabase: any = _supabase
