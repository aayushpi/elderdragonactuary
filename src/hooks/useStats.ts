import { useMemo } from "react"
import type { Game, ComputedStats } from "@/types"
import { computeStats } from "@/lib/stats"

export function useStats(games: Game[]): ComputedStats {
  return useMemo(() => computeStats(games), [games])
}
