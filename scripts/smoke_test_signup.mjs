#!/usr/bin/env node
/**
 * Post-deploy smoke test for Supabase signup.
 *
 * Verifies:
 *  1. Signup WITHOUT invite code → rejected (trigger works)
 *  2. Signup WITH valid invite code → 200 OK (full pipeline works)
 *  3. Signup WITH invalid invite code → rejected
 *
 * Requires env vars:
 *   SUPABASE_URL          - e.g. https://xxx.supabase.co
 *   SUPABASE_ANON_KEY     - the anon/public key
 *   SUPABASE_SERVICE_KEY  - (optional) service role key to clean up test users
 *   INVITE_CODE           - (optional) defaults to "BOLT THE BIRD"
 *
 * Usage:
 *   node scripts/smoke_test_signup.mjs
 *
 * Exit 0 = all checks pass, Exit 1 = a check failed.
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const INVITE_CODE = process.env.INVITE_CODE || "BOLT THE BIRD"

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_ANON_KEY env vars are required.")
  process.exit(1)
}

const createdUserIds = []
let failures = 0

async function signup(email, password, data) {
  const body = { email, password }
  if (data) body.data = data

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()
  const userId = json.id || json.user?.id
  if (userId) createdUserIds.push(userId)

  return { status: res.status, body: json }
}

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`)
  } else {
    console.log(`  ❌ ${label} — ${detail}`)
    failures++
  }
}

// --- Test 1: no invite code → should be rejected ---
console.log("\nTest 1: signup without invite code")
const t1 = await signup(`smoke+noinvite${Date.now()}@test.local`, "SmokePw123!")
check("Status is not 200", t1.status !== 200, `got ${t1.status}`)
check(
  "Error mentions invite code",
  /invite code/i.test(t1.body.message || t1.body.msg || ""),
  JSON.stringify(t1.body)
)

// --- Test 2: invalid invite code → should be rejected ---
console.log("\nTest 2: signup with invalid invite code")
const t2 = await signup(`smoke+bad${Date.now()}@test.local`, "SmokePw123!", {
  invite_code: "THIS_CODE_DOES_NOT_EXIST",
})
check("Status is not 200", t2.status !== 200, `got ${t2.status}`)
check(
  "Error mentions invalid",
  /invalid/i.test(t2.body.message || t2.body.msg || ""),
  JSON.stringify(t2.body)
)

// --- Test 3: valid invite code → should succeed ---
console.log("\nTest 3: signup with valid invite code")
const t3 = await signup(`smoke+ok${Date.now()}@test.local`, "SmokePw123!", {
  invite_code: INVITE_CODE,
})
check("Status is 200", t3.status === 200, `got ${t3.status}: ${JSON.stringify(t3.body)}`)
check("User ID returned", !!(t3.body.id || t3.body.user?.id), "no user id in response")

// --- Cleanup test users ---
if (SUPABASE_SERVICE_KEY && createdUserIds.length > 0) {
  console.log("\nCleaning up test users...")
  for (const uid of createdUserIds) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    })
    console.log(`  ${res.ok ? "✅" : "⚠️"} Deleted ${uid} (${res.status})`)
  }
} else if (createdUserIds.length > 0) {
  console.log("\n⚠️  Set SUPABASE_SERVICE_KEY to auto-delete test users.")
}

// --- Summary ---
console.log("")
if (failures > 0) {
  console.log(`💥 ${failures} check(s) failed.`)
  process.exit(1)
} else {
  console.log("🎉 All signup smoke tests passed.")
  process.exit(0)
}
