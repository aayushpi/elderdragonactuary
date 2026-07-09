import {
  Award,
  Baby,
  Crown,
  Flag,
  Flame,
  Gem,
  Handshake,
  Hourglass,
  Medal,
  Rainbow,
  RotateCcw,
  Skull,
  Sprout,
  Star,
  Sword,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Turtle,
  Zap,
} from "lucide-react"
import type { Milestone, MilestoneKind } from "./timeline"

type IconType = typeof Trophy

/** Icons addressable by name for per-milestone overrides (e.g. veteran tiers). */
const ICONS: Record<string, IconType> = { Sprout, Star, Medal, Gem }

const STYLES: Record<MilestoneKind, { icon: IconType; className: string }> = {
  "first-game": { icon: Flag, className: "bg-muted text-foreground" },
  "milestone-game": { icon: Award, className: "bg-primary/15 text-primary" },
  debut: { icon: Baby, className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  veteran: { icon: Star, className: "bg-stone-500/15 text-stone-600 dark:text-stone-300" },
  "first-win": { icon: Trophy, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  win: { icon: Crown, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  streak: { icon: Flame, className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  "fast-win": { icon: Zap, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  "slow-burn": { icon: Hourglass, className: "bg-lime-500/15 text-lime-600 dark:text-lime-400" },
  wincon: { icon: Swords, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  "tough-seat": { icon: Target, className: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  underdog: { icon: Turtle, className: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
  nemesis: { icon: Sword, className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  "new-rival": { icon: Handshake, className: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  comeback: { icon: RotateCcw, className: "bg-green-500/15 text-green-600 dark:text-green-400" },
  "color-pioneer": { icon: Rainbow, className: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400" },
  "bracket-buster": { icon: TrendingUp, className: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  "flawless-month": { icon: Trophy, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  knockout: { icon: Skull, className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  "loss-streak": { icon: TrendingDown, className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
}

function iconFor(milestone: Milestone): IconType {
  return (milestone.iconName && ICONS[milestone.iconName]) || STYLES[milestone.kind].icon
}

/** Compact pill — used where several milestones sit inline. */
export function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  const Icon = iconFor(milestone)
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium " +
        STYLES[milestone.kind].className
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {milestone.label}
    </span>
  )
}

/** Full discrete highlight event — headline + supporting detail. */
export function MilestoneEvent({ milestone }: { milestone: Milestone }) {
  const Icon = iconFor(milestone)
  return (
    <div className="flex items-center gap-3">
      <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-full " + STYLES[milestone.kind].className}>
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
