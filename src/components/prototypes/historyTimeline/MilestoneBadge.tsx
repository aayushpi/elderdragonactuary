import { Award, Flag, Flame, Sparkles, Trophy, Zap } from "lucide-react"
import type { Milestone, MilestoneKind } from "./timeline"

const STYLES: Record<MilestoneKind, { icon: typeof Trophy; className: string }> = {
  "first-game": { icon: Flag, className: "bg-muted text-foreground" },
  "first-win": { icon: Trophy, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  "milestone-game": { icon: Award, className: "bg-primary/15 text-primary" },
  streak: { icon: Flame, className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  debut: { icon: Sparkles, className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  "fast-win": { icon: Zap, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
}

export function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  const { icon: Icon, className } = STYLES[milestone.kind]
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " + className
      }
    >
      <Icon className="h-3 w-3 shrink-0" />
      {milestone.label}
    </span>
  )
}
