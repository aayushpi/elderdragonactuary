/**
 * Data layer for the admin usage dashboard.
 *
 * Everything here goes through the `security definer` RPCs added in
 * migration 007 — RLS would otherwise limit the caller to their own games.
 * The RPCs raise 42501 for non-admins, so a non-admin never sees another
 * account's data even if they call these directly from the console.
 */

import { supabase } from "@/lib/supabase"
import type { AdminAccountUsageRow, AdminUsageTotalsRow } from "@/types/database"

/** PostgREST serialises `bigint` and `numeric` inconsistently across versions —
 *  sometimes as JSON numbers, sometimes as strings to preserve precision.
 *  Coerce once here so the UI never has to think about it. */
function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toNullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export interface AdminAccount {
  userId: string
  email: string
  signedUpAt: string
  lastSignInAt: string | null
  emailConfirmed: boolean
  gamesLogged: number
  firstGameAt: string | null
  lastGameAt: string | null
  lastLoggedAt: string | null
  activeDays: number
  gamesLast7d: number
  gamesLast30d: number
  avgPodSize: number | null
  avgWinTurn: number | null
  wins: number
  /** Null rather than 0 when the account has no games — "no data" and "never
   *  won" are different states and must not render the same. */
  winRate: number | null
  daysSinceLastGame: number | null
}

export interface AdminTotals {
  totalAccounts: number
  accountsWithGames: number
  active7d: number
  active30d: number
  newAccounts30d: number
  totalGames: number
  games7d: number
  games30d: number
  medianGamesPerAccount: number | null
}

export interface AdminUsage {
  accounts: AdminAccount[]
  totals: AdminTotals
}

const MS_PER_DAY = 86_400_000

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.floor((Date.now() - then) / MS_PER_DAY)
}

function mapAccount(row: AdminAccountUsageRow): AdminAccount {
  const gamesLogged = toNum(row.games_logged)
  const wins = toNum(row.wins)
  return {
    userId: row.user_id,
    email: row.email ?? "(no email)",
    signedUpAt: row.signed_up_at,
    lastSignInAt: row.last_sign_in_at,
    emailConfirmed: Boolean(row.email_confirmed_at),
    gamesLogged,
    firstGameAt: row.first_game_at,
    lastGameAt: row.last_game_at,
    lastLoggedAt: row.last_logged_at,
    activeDays: toNum(row.active_days),
    gamesLast7d: toNum(row.games_last_7d),
    gamesLast30d: toNum(row.games_last_30d),
    avgPodSize: toNullableNum(row.avg_pod_size),
    avgWinTurn: toNullableNum(row.avg_win_turn),
    wins,
    winRate: gamesLogged > 0 ? wins / gamesLogged : null,
    daysSinceLastGame: daysSince(row.last_game_at),
  }
}

function mapTotals(row: AdminUsageTotalsRow | undefined): AdminTotals {
  return {
    totalAccounts: toNum(row?.total_accounts),
    accountsWithGames: toNum(row?.accounts_with_games),
    active7d: toNum(row?.active_7d),
    active30d: toNum(row?.active_30d),
    newAccounts30d: toNum(row?.new_accounts_30d),
    totalGames: toNum(row?.total_games),
    games7d: toNum(row?.games_7d),
    games30d: toNum(row?.games_30d),
    medianGamesPerAccount: toNullableNum(row?.median_games_per_account),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpc(fn: string): Promise<{ data: any; error: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(fn)
}

/** Whether the signed-in user may see the admin dashboard. Resolves false
 *  rather than throwing when Supabase is unconfigured or the call fails, so
 *  the route simply stays hidden. */
export async function fetchIsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await rpc("is_admin")
    if (error) return false
    return data === true
  } catch {
    return false
  }
}

export async function fetchAdminUsage(): Promise<AdminUsage> {
  const [usage, totals] = await Promise.all([rpc("admin_account_usage"), rpc("admin_usage_totals")])

  if (usage.error) throw new Error(usage.error.message ?? "Could not load account usage.")
  if (totals.error) throw new Error(totals.error.message ?? "Could not load usage totals.")

  const rows: AdminAccountUsageRow[] = Array.isArray(usage.data) ? usage.data : []
  const totalsRow: AdminUsageTotalsRow | undefined = Array.isArray(totals.data) ? totals.data[0] : undefined

  return { accounts: rows.map(mapAccount), totals: mapTotals(totalsRow) }
}
