import { Award, Crown, Flag, Flame, Sparkles, Swords, Trophy, Zap } from "lucide-react"
import type { Milestone, MilestoneKind } from "./timeline"

const STYLES: Record<MilestoneKind, { icon: typeof Trophy; className: string }> = {
  "first-game": { icon: Flag, className: "bg-muted text-foreground" },
  "milestone-game": { icon: Award, className: "bg-primary/15 text-primary" },
  debut: { icon: Sparkles, className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  "first-win": { icon: Trophy, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  win: { icon: Crown, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  streak: { icon: Flame, className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  "fast-win": { icon: Zap, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  wincon: { icon: Swords, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
}

/** Compact pill — used where several milestones sit inline. */
export function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  const { icon: Icon, className } = STYLES[milestone.kind]
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium " + className
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {milestone.label}
    </span>
  )
}

/** Full discrete highlight event — headline + supporting detail. */
export function MilestoneEvent({ milestone }: { milestone: Milestone }) {
  const { icon: Icon, className } = STYLES[milestone.kind]
  return (
    <div className="flex items-center gap-3">
      <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-full " + className}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-base font-semibold leading-tight">{milestone.label}</div>
        {milestone.detail && (
          <div className="text-sm text-muted-foreground leading-tight">{milestone.detail}</div>
        )}
      </div>
    </div>
  )
}
