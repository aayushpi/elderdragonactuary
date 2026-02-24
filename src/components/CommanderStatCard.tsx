import type { CommanderStat, WinRateStat } from "@/types"

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) return null
  const styles = [
    "bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 border-yellow-400/50",
    "bg-zinc-400/20 text-zinc-600 dark:text-zinc-300 border-zinc-400/50",
    "bg-orange-400/20 text-orange-700 dark:text-orange-300 border-orange-400/50",
  ]
  const labels = ["#1", "#2", "#3"]
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none shrink-0 ${styles[rank - 1]}`}>
      {labels[rank - 1]}
    </span>
  )
}

interface MiniStatCardProps {
  label: string
  value: string
  sub?: string
}

function MiniStatCard({ label, value, sub }: MiniStatCardProps) {
  return (
    <div className="rounded-md border bg-muted/40 px-2.5 py-2">
      <p className="text-xs text-muted-foreground leading-none">{label}</p>
      <p className="text-base font-bold mt-1 leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function fmtStat(stat: WinRateStat): { val: string; sub: string } {
  if (stat.games === 0) return { val: "—", sub: "no games" }
  return {
    val: `${Math.round(stat.rate * 100)}%`,
    sub: `${stat.wins}W / ${stat.games}G`,
  }
}

interface CommanderStatCardProps {
  stat: CommanderStat
  rank?: number
}

export function CommanderStatCard({ stat, rank }: CommanderStatCardProps) {
  const avgTurn = stat.averageWinTurn !== null ? stat.averageWinTurn.toFixed(1) : "—"
  const overall = fmtStat({ wins: stat.wins, games: stat.games, rate: stat.rate })
  const withFm = fmtStat(stat.withFastMana)
  const vsFm = fmtStat(stat.againstFastMana)

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Header: thumbnail + rank badge + name */}
      <div className="flex items-center gap-3">
        {stat.imageUri ? (
          <img
            src={stat.imageUri}
            alt={stat.name}
            className="w-14 h-14 rounded object-cover object-center border border-border shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
            ?
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {rank !== undefined && rank <= 3 && <RankBadge rank={rank} />}
          <p className="text-sm font-semibold leading-snug">{stat.name}</p>
        </div>
      </div>

      {/* Floating stat cards grid */}
      <div className="grid grid-cols-2 gap-2">
        <MiniStatCard label="Win Rate" value={overall.val} sub={overall.sub} />
        <MiniStatCard
          label="Avg Win Turn"
          value={avgTurn}
          sub={stat.wins > 0 ? `${stat.wins} win${stat.wins !== 1 ? "s" : ""}` : "no wins"}
        />
        <MiniStatCard label="With Fast Mana" value={withFm.val} sub={withFm.sub} />
        <MiniStatCard label="vs Fast Mana" value={vsFm.val} sub={vsFm.sub} />
      </div>
    </div>
  )
}
