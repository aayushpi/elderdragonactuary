#!/usr/bin/env node
/**
 * Keeps the free-tier Supabase project from auto-pausing.
 *
 * Calls public.keepalive_ping() (see supabase/migrations/006_keepalive.sql),
 * which performs a real Postgres write and returns the previous ping time.
 * Exits non-zero if the gap since the previous ping exceeded the pause window,
 * which means the schedule stopped running and needs attention.
 *
 * Requires env vars:
 *   SUPABASE_URL              - e.g. https://xxx.supabase.co
 *   SUPABASE_ANON_KEY         - the anon/public key
 *   KEEPALIVE_SOURCE          - (optional) label stored with the ping
 *   KEEPALIVE_MAX_GAP_DAYS    - (optional) defaults to 7
 *
 * Usage:
 *   node scripts/keepalive_ping.mjs
 *
 * Exit 0 = project pinged and the schedule is healthy, Exit 1 = needs a look.
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SOURCE = process.env.KEEPALIVE_SOURCE || "github-actions"
const MAX_GAP_DAYS = Number(process.env.KEEPALIVE_MAX_GAP_DAYS || 7)

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_ANON_KEY env vars are required.")
  process.exit(1)
}

const ATTEMPTS = 3

async function ping() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/keepalive_ping`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_source: SOURCE }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)

  const rows = JSON.parse(text)
  const row = Array.isArray(rows) ? rows[0] : rows
  if (!row?.pinged_at) throw new Error(`Unexpected response: ${text.slice(0, 300)}`)
  return row
}

let row
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  try {
    row = await ping()
    break
  } catch (err) {
    console.error(`Attempt ${attempt}/${ATTEMPTS} failed: ${err.message}`)
    if (attempt === ATTEMPTS) {
      console.error(
        `❌ Keepalive ping failed after ${ATTEMPTS} attempts. If the errors above are ` +
          `network/5xx rather than a 4xx, the project may already be paused.`
      )
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, attempt * 5000))
  }
}

const gapDays = (new Date(row.pinged_at) - new Date(row.previous_pinged_at)) / 86_400_000

console.log(`✅ Pinged at ${row.pinged_at} (source: ${SOURCE}, total pings: ${row.total_pings})`)
console.log(`   Previous ping: ${row.previous_pinged_at} — ${gapDays.toFixed(1)} days ago`)

if (gapDays > MAX_GAP_DAYS) {
  console.error(
    `❌ Gap of ${gapDays.toFixed(1)} days exceeds the ${MAX_GAP_DAYS}-day pause window. ` +
      `The schedule stopped running — check that the keepalive workflow is still enabled.`
  )
  process.exit(1)
}
