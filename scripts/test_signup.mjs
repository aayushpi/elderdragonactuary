#!/usr/bin/env node
/**
 * Smoke-test for Supabase signup with invite code.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=ey... node scripts/test_signup.mjs
 *
 * This creates a throwaway user with a random email and the given invite code,
 * then immediately deletes the user via the Admin API if SUPABASE_SERVICE_KEY is set.
 *
 * Exit 0 = signup succeeded, Exit 1 = signup failed.
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY // optional, for cleanup
const INVITE_CODE = process.env.INVITE_CODE || "BOLT THE BIRD"

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY env vars.")
  process.exit(1)
}

const randomEmail = `test+${Date.now()}@example.com`
const password = "TestPass123!"

console.log(`Testing signup with email=${randomEmail}, invite_code="${INVITE_CODE}"`)

const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    email: randomEmail,
    password,
    data: { invite_code: INVITE_CODE },
  }),
})

const body = await res.json()

if (!res.ok || body.error || body.msg) {
  console.error("SIGNUP FAILED")
  console.error("Status:", res.status)
  console.error("Response:", JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log("SIGNUP SUCCEEDED")
console.log("User ID:", body.id || body.user?.id)

// Cleanup: delete the test user if service key is available
if (SUPABASE_SERVICE_KEY && (body.id || body.user?.id)) {
  const uid = body.id || body.user?.id
  const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  if (delRes.ok) {
    console.log("Test user cleaned up.")
  } else {
    console.warn("Could not delete test user:", delRes.status)
  }
}
