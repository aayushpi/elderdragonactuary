import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { Game } from "@/types"
import { VariantJourney } from "@/components/prototypes/historyTimeline/VariantJourney"
import { VariantChapters } from "@/components/prototypes/historyTimeline/VariantChapters"
import { VariantFeed } from "@/components/prototypes/historyTimeline/VariantFeed"
import { buildSampleGames } from "@/components/prototypes/historyTimeline/sampleGames"

interface Variant {
  id: string
  name: string
  tagline: string
  render: (games: Game[]) => React.ReactNode
}

const VARIANTS: Variant[] = [
  {
    id: "journey",
    name: "Journey",
    tagline: "A vertical spine of your whole career — every game a node, wins lit up.",
    render: (games) => <VariantJourney games={games} />,
  },
  {
    id: "chapters",
    name: "Chapters",
    tagline: "Your history told month by month, each with its own record and signature deck.",
    render: (games) => <VariantChapters games={games} />,
  },
  {
    id: "activity",
    name: "Activity",
    tagline: "A play heatmap and a social-style feed of wins, losses and milestones.",
    render: (games) => <VariantFeed games={games} />,
  },
]

interface PrototypesPageProps {
  games: Game[]
}

export function PrototypesPage({ games }: PrototypesPageProps) {
  const [active, setActive] = useState(VARIANTS[0].id)
  const hasRealGames = games.length > 0
  const [useSample, setUseSample] = useState(!hasRealGames)

  const sample = useMemo(() => buildSampleGames(), [])
  const data = useSample ? sample : games
  const variant = VARIANTS.find((v) => v.id === active) ?? VARIANTS[0]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">History · Timeline</h1>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Prototype
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Three takes on reimagining the History page as a personal timeline.
        </p>
      </div>

      {/* Variant switcher */}
      <div className="inline-flex rounded-md border border-input p-0.5 gap-0.5">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            onClick={() => setActive(v.id)}
            className={cn(
              "h-9 px-4 rounded-[8px] text-sm font-medium transition-colors",
              active === v.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{variant.tagline}</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={useSample}
            onChange={(e) => setUseSample(e.target.checked)}
            className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
          />
          Sample data
          {!hasRealGames && <span className="opacity-60">(no real games yet)</span>}
        </label>
      </div>

      <div>{variant.render(data)}</div>
    </div>
  )
}
