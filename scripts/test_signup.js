#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY_PROD || process.env.VITE_SUPABASE_ANON_KEY_STAGING

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment')
  process.exit(1)
}

const supabase = createClient(url, key)

async function run() {
  try {
    const email = process.env.TEST_SIGNUP_EMAIL || `signup-test+${Date.now()}@example.com`
    const password = process.env.TEST_SIGNUP_PASSWORD || 'Test1234!'
    console.log('Attempting signup with', { email, inviteCode: 'BOLT THE BIRD' })

    const resp = await supabase.auth.signUp({ email, password }, { data: { invite_code: 'BOLT THE BIRD' } })
    console.log('resp:', JSON.stringify(resp, Object.getOwnPropertyNames(resp), 2))
  } catch (err) {
    console.error('exception:', err)
  }
}

run()
