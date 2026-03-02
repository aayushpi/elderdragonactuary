import type { Game } from "@/types"

interface MapPageProps {
  games: Game[]
}

export function MapPage({ games }: MapPageProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">Map</h1>
      <p className="text-sm text-muted-foreground">
        Geographic map view is not configured in this environment.
      </p>
      <p className="text-xs text-muted-foreground">
        Loaded games: {games.length}
      </p>
    </div>
  )
}
