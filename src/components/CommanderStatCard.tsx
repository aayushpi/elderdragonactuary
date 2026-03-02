import { useEffect, useRef, useState } from "react"
import { fetchCardByName, resolveArtCrop, resolvePng } from "@/lib/scryfall"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { CommanderStat, WinRateStat } from "@/types"

const statsImageCache = new Map<string, string | null>()
const keyCardImageCache = new Map<string, string | null>()
const commanderHoverImageCache = new Map<string, string | null>()

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
    <Card className="h-full">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-2xl font-bold mt-1 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function fmtStat(stat: WinRateStat): { val: string; sub: string } {
  if (stat.games === 0) return { val: "—", sub: "no games" }
  return {
    val: `${Math.round(stat.rate * 100)}%`,
    sub: `${stat.wins} wins / ${stat.games} games`,
  }
}

function KeyCardsStatCard({ cards }: { cards: CommanderStat["keyCards"] }) {
  const [hoveredCard, setHoveredCard] = useState<{ name: string; imageUri?: string } | null>(null)
  const [hoverCoords, setHoverCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const activeHoverRef = useRef<string | null>(null)
  const hoverCardRef = useRef<HTMLDivElement>(null)

  async function handleCardHover(cardName: string, event: React.MouseEvent) {
    if (hoveredCard?.name === cardName) return
    activeHoverRef.current = cardName
    // compute coordinates for popup placement relative to viewport
    try {
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const popupHeight = 400
      const spacing = 8
      const left = rect.left + rect.width / 2
      const canPlaceBelow = rect.bottom + popupHeight + spacing <= window.innerHeight
      const top = canPlaceBelow ? rect.bottom + spacing : rect.top - popupHeight - spacing
      setHoverCoords({ top, left })
    } catch {
      // ignore coordinate errors
    }
    const cached = keyCardImageCache.get(cardName)
    if (cached !== undefined) {
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: cached ?? undefined })
      return
    }

    try {
      const card = await fetchCardByName(cardName)
      // Prefer full-card PNG for hover so users can read card text; fall back to art_crop
      const imageUri = resolvePng(card) ?? resolveArtCrop(card)
      keyCardImageCache.set(cardName, imageUri ?? null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: imageUri ?? undefined })
    } catch {
      keyCardImageCache.set(cardName, null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName })
    }
  }

  function handleCardLeave() {
    activeHoverRef.current = null
    setHoveredCard(null)
  }

  

  return (
    <Card className="h-full">
      <CardContent className="pt-4 pb-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Key Cards</p>
      {cards.length === 0 ? (
        <p className="text-2xl font-bold mt-1 leading-none">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cards.map((card) => (
            <div
              key={card.name}
              className="relative"
              onMouseEnter={(e) => {
                if (window.matchMedia('(hover: hover)').matches) {
                  handleCardHover(card.name, e)
                }
              }}
              onMouseLeave={() => {
                if (window.matchMedia('(hover: hover)').matches) {
                  handleCardLeave()
                }
              }}
            >
              <span
                className="inline-flex items-center rounded-md border bg-background px-1.5 py-0.5 text-xs cursor-pointer"
              >
                {card.name}
                <span className="ml-1 text-muted-foreground">×{card.count}</span>
              </span>

              {hoveredCard?.name === card.name && window.matchMedia('(hover: hover)').matches && (
                <div
                  ref={hoverCardRef}
                  className={`fixed z-[9999]`}
                  style={{ zIndex: 9999, top: `${hoverCoords.top}px`, left: `${hoverCoords.left}px`, transform: 'translateX(-50%)' }}
                >
                  <div className="bg-popover border rounded-md shadow-lg p-2" style={{ minWidth: "320px" }}>
                    {hoveredCard.imageUri ? (
                      <img
                        src={hoveredCard.imageUri}
                        alt={card.name}
                        style={{ width: "300px", height: "auto", display: "block", maxWidth: "none" }}
                        className="rounded-md"
                      />
                    ) : (
                      <div className="w-[300px] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground p-4">
                        {card.name}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </CardContent>
    </Card>
  )
}

function RecentResultsCard({ results }: { results: CommanderStat["recentResults"] }) {
  return (
    <Card className="h-full">
      <CardContent className="pt-4 pb-4 h-full flex flex-col">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Last 10</p>
      {results.length === 0 ? (
        <div className="flex-1 flex items-center mt-1">
          <p className="text-2xl font-bold leading-none">—</p>
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="flex-1 flex items-center mt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
            {results.map((entry, idx) => {
              const date = new Date(entry.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })

              return (
                <Tooltip key={`${entry.result}-${entry.date}-${idx}`}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold cursor-pointer transition-transform hover:scale-110 ${
                        entry.result === "W"
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-600"
                          : "bg-red-500/20 border-red-500 text-red-600"
                      }`}
                    >
                      {entry.result}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className={entry.result === "W" ? "text-emerald-400" : "text-red-400"}>
                        {entry.result === "W"
                          ? `Won on Turn ${entry.winTurn}`
                          : `Lost to ${entry.winningCommander} on Turn ${entry.winTurn}`}
                      </p>
                      <p className="text-muted-foreground">{date}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
            </div>
          </div>
        </TooltipProvider>
      )}
      </CardContent>
    </Card>
  )
}

interface CommanderStatCardProps {
  stat: CommanderStat
  rank?: number
}

export function CommanderStatCard({ stat, rank }: CommanderStatCardProps) {
  const [resolvedImageUri, setResolvedImageUri] = useState<string | undefined>(stat.imageUri)
  const avgTurn = stat.averageWinTurn !== null ? stat.averageWinTurn.toFixed(1) : "—"
  const overall = fmtStat({ wins: stat.wins, games: stat.games, rate: stat.rate })
  const withFm = fmtStat(stat.withFastMana)
  const vsFm = fmtStat(stat.againstFastMana)

  const [hoveredThumbnail, setHoveredThumbnail] = useState<{ name: string; imageUri?: string } | null>(null)
  const [thumbnailCoords, setThumbnailCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const thumbnailActiveRef = useRef<string | null>(null)
  const thumbnailHoverRef = useRef<HTMLDivElement>(null)

  async function handleThumbnailHover(event: React.MouseEvent) {
    if (hoveredThumbnail?.name === stat.name) return
    thumbnailActiveRef.current = stat.name

    // compute coordinates for thumbnail popup
    try {
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const popupHeight = 400
      const spacing = 8
      const left = rect.left + rect.width / 2
      const canPlaceBelow = rect.bottom + popupHeight + spacing <= window.innerHeight
      const top = canPlaceBelow ? rect.bottom + spacing : rect.top - popupHeight - spacing
      setThumbnailCoords({ top, left })
    } catch {
      // ignore
    }

    const cached = commanderHoverImageCache.get(stat.name)
    if (cached !== undefined) {
      if (thumbnailActiveRef.current !== stat.name) return
      setHoveredThumbnail({ name: stat.name, imageUri: cached ?? undefined })
      return
    }

    try {
      const card = await fetchCardByName(stat.name)
      const imageUri = resolvePng(card) ?? resolveArtCrop(card)
      commanderHoverImageCache.set(stat.name, imageUri ?? null)
      if (thumbnailActiveRef.current !== stat.name) return
      setHoveredThumbnail({ name: stat.name, imageUri: imageUri ?? undefined })
    } catch {
      commanderHoverImageCache.set(stat.name, null)
      if (thumbnailActiveRef.current !== stat.name) return
      setHoveredThumbnail({ name: stat.name })
    }
  }

  function handleThumbnailLeave() {
    thumbnailActiveRef.current = null
    setHoveredThumbnail(null)
  }

  

  useEffect(() => {
    let isCancelled = false

    async function resolveMissingImage() {
      if (stat.imageUri) {
        setResolvedImageUri(stat.imageUri)
        return
      }

      const cached = statsImageCache.get(stat.name)
      if (cached !== undefined) {
        setResolvedImageUri(cached ?? undefined)
        return
      }

      try {
        const card = await fetchCardByName(stat.name)
        const fetchedImage = resolveArtCrop(card) ?? null
        statsImageCache.set(stat.name, fetchedImage)
        if (!isCancelled) {
          setResolvedImageUri(fetchedImage ?? undefined)
        }
      } catch {
        statsImageCache.set(stat.name, null)
        if (!isCancelled) {
          setResolvedImageUri(undefined)
        }
      }
    }

    resolveMissingImage()
    return () => {
      isCancelled = true
    }
  }, [stat.name, stat.imageUri])

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Header: thumbnail + rank badge + name */}
      <div className="flex items-center gap-3">
        {/* Thumbnail with hover preview (prefer full PNG) */}
        <div
          className="relative"
          onMouseEnter={(e) => {
            if (window.matchMedia('(hover: hover)').matches) {
              handleThumbnailHover(e)
            }
          }}
          onMouseLeave={() => {
            if (window.matchMedia('(hover: hover)').matches) {
              handleThumbnailLeave()
            }
          }}
        >
          {resolvedImageUri ? (
            <img
              src={resolvedImageUri}
              alt={stat.name}
              className="w-14 h-14 rounded object-cover object-center border border-border shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
              ?
            </div>
          )}

          {hoveredThumbnail?.name === stat.name && window.matchMedia('(hover: hover)').matches && (
            <div
              ref={thumbnailHoverRef}
              className={`fixed z-[9999]`}
              style={{ zIndex: 9999, top: `${thumbnailCoords.top}px`, left: `${thumbnailCoords.left}px`, transform: 'translateX(-50%)' }}
            >
              <div className="bg-popover border rounded-md shadow-lg p-2" style={{ minWidth: "320px" }}>
                {hoveredThumbnail.imageUri ? (
                  <img
                    src={hoveredThumbnail.imageUri}
                    alt={stat.name}
                    style={{ width: "300px", height: "auto", display: "block", maxWidth: "none" }}
                    className="rounded-md"
                  />
                ) : (
                  <div className="w-[300px] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground p-4">
                    {stat.name}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {rank !== undefined && rank <= 3 && <RankBadge rank={rank} />}
          <p className="text-sm font-semibold leading-snug">{stat.name}</p>
        </div>
      </div>

      {/* Floating stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MiniStatCard label="Win Rate" value={overall.val} sub={overall.sub} />
        <MiniStatCard
          label="Avg Win Turn"
          value={avgTurn}
          sub={stat.wins > 0 ? `${stat.wins} win${stat.wins !== 1 ? "s" : ""}` : "no wins"}
        />
        <MiniStatCard label="With Fast Mana" value={withFm.val} sub={withFm.sub} />
        <MiniStatCard label="vs Fast Mana" value={vsFm.val} sub={vsFm.sub} />
        <RecentResultsCard results={stat.recentResults} />
        <KeyCardsStatCard cards={stat.keyCards} />
      </div>
    </div>
  )
}
