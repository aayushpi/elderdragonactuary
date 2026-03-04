#!/usr/bin/env node
// Assign up to N invite codes to each existing user using service role key.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/assign_invites.cjs

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  try {
    // list users (admin API)
    const listResp = await supabase.auth.admin.listUsers()
    if (listResp.error) throw listResp.error
    const users = listResp.data.users
    console.log(`Found ${users.length} users`)

    for (const user of users) {
      const userId = user.id
      // find available codes
      const { data: codes, error: selErr } = await supabase
        .from('invite_codes')
        .select('code')
        .is('created_by', null)
        .order('created_at', { ascending: true })
        .limit(5)
      if (selErr) {
        console.error('select error for user', userId, selErr)
        continue
      }
      if (!codes || codes.length === 0) {
        console.log('No available codes left')
        break
      }
      const codeList = codes.map((r) => r.code)
      const { error: upErr } = await supabase.from('invite_codes').update({ created_by: userId }).in('code', codeList)
      if (upErr) {
        console.error('update error for user', userId, upErr)
        continue
      }
      console.log(`Assigned ${codeList.length} codes to user ${userId}`)
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

main()
