import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null | undefined

export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) {
    return client
  }

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    client = null
    return client
  }

  client = createClient(url, anonKey, {
    auth: {
      lock: async <R>(
        _name: string,
        _acquireTimeout: number,
        fn: () => Promise<R>
      ): Promise<R> => await fn(),
    },
  })
  return client
}
