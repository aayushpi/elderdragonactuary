/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase"

function generateCode(): string {
  // Use a short readable unique token from UUID when available on the platform
  const maybe = globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  if (maybe.crypto && typeof maybe.crypto.randomUUID === "function") {
    return maybe.crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  }
  // Fallback
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export async function createInviteCode(remainingUses = 1): Promise<{ code?: string; error?: string | null }> {
  const maxAttempts = 5
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCode()
    try {
      // insert a new code row; Supabase will return an error if it conflicts
      // Using the simple client .from API used across the app
      const resp = await (supabase as any).from("invite_codes").insert({ code, remaining_uses: remainingUses })
      const error = resp?.error
      if (!error) return { code }
      // if error indicates conflict, try again
      // otherwise fallthrough and retry a few times
    } catch (err: unknown) {
      // continue retrying on unexpected errors up to attempts
      if (i === maxAttempts - 1) return { error: String((err as { message?: string })?.message ?? err) }
    }
  }
  return { error: "Could not create invite code; try again." }
}

export async function createMultipleInviteCodes(count = 1, remainingUses = 1): Promise<{ codes?: string[]; error?: string | null }> {
  const codes: string[] = []
  for (let i = 0; i < count; i++) codes.push(generateCode())
  try {
    const resp = await (supabase as any).from("invite_codes").insert(codes.map((c) => ({ code: c, remaining_uses: remainingUses })))
    const error = resp?.error
    if (error) return { error: (error as { message?: string })?.message ?? String(error) }
    return { codes }
  } catch (err: unknown) {
    return { error: String((err as { message?: string })?.message ?? err) }
  }
}

export async function claimInviteCodes(count = 1): Promise<{ codes?: string[]; error?: string | null }> {
  try {
    // get current user id
    const userResp = await (supabase as any).auth.getUser()
    const user = userResp?.data?.user
    const userId = user?.id
    if (!userId) return { error: "Not authenticated" }

    // select available codes
    const selResp = await (supabase as any)
      .from("invite_codes")
      .select("code")
      .is("created_by", null)
      .order("created_at", { ascending: true })
      .limit(count)
    const data = selResp?.data
    const selErr = selResp?.error

    if (selErr) return { error: selErr?.message ?? String(selErr) }
    const rows = (data ?? []) as Array<{ code: string }>
    if (rows.length === 0) return { codes: [] }

    const codes = rows.map((r) => r.code)
    // claim them by setting created_by = userId
    const upResp = await (supabase as any).from("invite_codes").update({ created_by: userId }).in("code", codes)
    const upErr = upResp?.error
    if (upErr) return { error: (upErr as { message?: string })?.message ?? String(upErr) }
    return { codes }
  } catch (err: unknown) {
    return { error: String((err as { message?: string })?.message ?? err) }
  }
}


