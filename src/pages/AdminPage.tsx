import { useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/StatCard"
import { useAdminUsage } from "@/hooks/useAdminUsage"
import { capture } from "@/lib/analytics"
import type { AdminAccount } from "@/lib/adminStats"

type SortKey =
  | "email"
  | "gamesLogged"
  | "lastGameAt"
  | "gamesLast7d"
  | "gamesLast30d"
  | "activeDays"
  | "winRate"
  | "signedUpAt"

const MS_PER_DAY = 86_400_000

function relativeDays(iso: string | null): string {
  if (!iso) return "never"
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return "—"
  const days = Math.floor(diff / MS_PER_DAY)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function shortDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`
}

function decimal(value: number | null): string {
  return value === null ? "—" : String(value)
}

/** An account that has signed up but never logged anything is the single most
 *  actionable row on this page, so it gets its own visual treatment. */
function activityTone(account: AdminAccount): string {
  if (account.gamesLogged === 0) return "text-muted-foreground"
  if (account.daysSinceLastGame !== null && account.daysSinceLastGame > 30) return "text-amber-600 dark:text-amber-400"
  return "text-foreground"
}

function sortValue(account: AdminAccount, key: SortKey): string | number {
  switch (key) {
    case "email":
      return account.email.toLowerCase()
    case "lastGameAt":
      return account.lastGameAt ? new Date(account.lastGameAt).getTime() : -Infinity
    case "signedUpAt":
      return new Date(account.signedUpAt).getTime()
    case "winRate":
      return account.winRate ?? -Infinity
    default:
      return account[key]
  }
}

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "email", label: "Account" },
  { key: "gamesLogged", label: "Games", numeric: true },
  { key: "lastGameAt", label: "Last game", numeric: true },
  { key: "gamesLast7d", label: "7d", numeric: true },
  { key: "gamesLast30d", label: "30d", numeric: true },
  { key: "activeDays", label: "Active days", numeric: true },
  { key: "winRate", label: "Win rate", numeric: true },
  { key: "signedUpAt", label: "Joined", numeric: true },
]

export function AdminPage() {
  const { isAdmin, usage, loading, error, refresh } = useAdminUsage()
  const [sortKey, setSortKey] = useState<SortKey>("lastGameAt")
  const [descending, setDescending] = useState(true)
  const [query, setQuery] = useState("")

  const accountCount = usage?.accounts.length ?? 0
  useEffect(() => {
    if (isAdmin && usage) capture("admin_dashboard_viewed", { accounts: accountCount })
  }, [isAdmin, usage, accountCount])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? (usage?.accounts ?? []).filter((a) => a.email.toLowerCase().includes(needle))
      : (usage?.accounts ?? [])

    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av === bv) return a.email.localeCompare(b.email)
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv)
      return descending ? -cmp : cmp
    })
  }, [usage, sortKey, descending, query])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((d) => !d)
      return
    }
    setSortKey(key)
    setDescending(true)
  }

  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading usage…</span>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            This page is only available to administrators.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totals = usage?.totals

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">Usage by account</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 h-9 px-3 text-sm rounded-md border border-input hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Accounts"
            value={totals.totalAccounts}
            description={`${totals.newAccounts30d} new in 30d`}
          />
          <StatCard
            label="Activated"
            value={totals.accountsWithGames}
            description={
              totals.totalAccounts > 0
                ? `${Math.round((totals.accountsWithGames / totals.totalAccounts) * 100)}% logged a game`
                : "no accounts yet"
            }
          />
          <StatCard
            label="Active (30d)"
            value={totals.active30d}
            description={`${totals.active7d} in the last 7d`}
          />
          <StatCard
            label="Games"
            value={totals.totalGames}
            description={`${totals.games30d} in 30d · median ${decimal(totals.medianGamesPerAccount)}/account`}
          />
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by email…"
          className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* The table headers double as sort controls, but they are desktop-only,
          so phones get an equivalent here rather than no sorting at all. */}
      <div className="flex items-center gap-2 md:hidden">
        <label htmlFor="admin-sort" className="sr-only">
          Sort accounts by
        </label>
        <select
          id="admin-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
        >
          {COLUMNS.map((col) => (
            <option key={col.key} value={col.key}>
              Sort by {col.label.toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDescending((d) => !d)}
          className="inline-flex items-center gap-1 h-9 px-3 text-sm rounded-md border border-input hover:bg-accent transition-colors"
          aria-label={descending ? "Sort ascending" : "Sort descending"}
        >
          {descending ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
          {descending ? "Desc" : "Asc"}
        </button>
      </div>

      {/* Narrow viewports get stacked cards — an eight-column table is unusable
          on a phone, and this app is mostly opened on one. */}
      <div className="space-y-2 md:hidden">
        {rows.map((a) => (
          <Card key={a.userId}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium truncate">{a.email}</span>
                <span className={`text-sm font-semibold tabular-nums ${activityTone(a)}`}>
                  {a.gamesLogged}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Last game</span>
                <span className={`text-right tabular-nums ${activityTone(a)}`}>
                  {relativeDays(a.lastGameAt)}
                </span>
                <span>7d / 30d</span>
                <span className="text-right tabular-nums">
                  {a.gamesLast7d} / {a.gamesLast30d}
                </span>
                <span>Active days</span>
                <span className="text-right tabular-nums">{a.activeDays}</span>
                <span>Win rate</span>
                <span className="text-right tabular-nums">{percent(a.winRate)}</span>
                <span>Joined</span>
                <span className="text-right tabular-nums">{shortDate(a.signedUpAt)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`py-2 font-medium ${col.numeric ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                      sortKey === col.key ? "text-foreground" : ""
                    }`}
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.userId} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <div className="font-medium truncate max-w-[18rem]">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    last seen {relativeDays(a.lastSignInAt)}
                    {!a.emailConfirmed && " · unconfirmed"}
                  </div>
                </td>
                <td className={`py-2 text-right tabular-nums font-semibold ${activityTone(a)}`}>
                  {a.gamesLogged}
                </td>
                <td className={`py-2 text-right tabular-nums ${activityTone(a)}`}>
                  {relativeDays(a.lastGameAt)}
                </td>
                <td className="py-2 text-right tabular-nums">{a.gamesLast7d}</td>
                <td className="py-2 text-right tabular-nums">{a.gamesLast30d}</td>
                <td className="py-2 text-right tabular-nums">{a.activeDays}</td>
                <td className="py-2 text-right tabular-nums">{percent(a.winRate)}</td>
                <td className="py-2 text-right tabular-nums whitespace-nowrap">
                  {shortDate(a.signedUpAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {query ? "No accounts match that filter." : "No accounts yet."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
