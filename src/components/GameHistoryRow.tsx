import { useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ChevronDown } from "lucide-react"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import type { Game } from "@/types"

const commanderImageCache = new Map<string, string | null>()

interface GameHistoryRowProps {
  game: Game
  onClick: () => void
  isOpen: boolean
}

export function GameHistoryRow({ game, onClick, isOpen }: GameHistoryRowProps) {
  // ── Data preparation ──────────────────────────────────────────────────────
  const me = game.players.find((p) => p.isMe)
  const iWon = me && game.winnerId === me.id
  const date = new Date(game.playedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  // Hover state for commander cards
  const [hoveredCard, setHoveredCard] = useState<{ name: string; imageUri?: string } | null>(null)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const activeHoverRef = useRef<string | null>(null)
  const hoverCardRef = useRef<HTMLDivElement>(null)

  async function handleCardHover(cardName: string, event: React.MouseEvent) {
    if (hoveredCard?.name === cardName) return
    activeHoverRef.current = cardName

    // Determine position based on distance from top of viewport
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const distanceFromTop = rect.top
    
    // Calculate fixed position for the card
    const cardLeft = rect.left + rect.width / 2
    const estimatedCardHeight = 420 // Approximate height of card popup
    
    if (distanceFromTop < window.innerHeight / 2) {
      // Show below
      setCardPosition({ top: rect.bottom + 8, left: cardLeft })
    } else {
      // Show above
      setCardPosition({ top: rect.top - estimatedCardHeight - 8, left: cardLeft })
    }

    const cached = commanderImageCache.get(cardName)
    if (cached !== undefined) {
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: cached ?? undefined })
      return
    }

    try {
      const card = await fetchCardByName(cardName)
      const imageUri = resolveArtCrop(card)
      commanderImageCache.set(cardName, imageUri ?? null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: imageUri ?? undefined })
    } catch {
      commanderImageCache.set(cardName, null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName })
    }
  }

  function handleCardLeave() {
    activeHoverRef.current = null
    setHoveredCard(null)
  }

  return (
    <div
      className="w-full text-left p-3 sm:hover:bg-muted/50 sm:transition-colors sm:cursor-pointer space-y-2"
      onClick={onClick}
    >
      {/* ── Header row (always visible) ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant={iWon ? "default" : "secondary"} className="text-xs shrink-0">
            {iWon ? "Win" : "Loss"}
          </Badge>
          {me && (
            <>
              <div
                className="relative flex items-center gap-2 min-w-0 pointer-events-none sm:pointer-events-auto"
                onMouseEnter={(e) => {
                  if (window.matchMedia('(hover: hover)').matches) {
                    handleCardHover(me.commanderName, e)
                  }
                }}
                onMouseLeave={() => {
                  if (window.matchMedia('(hover: hover)').matches) {
                    handleCardLeave()
                  }
                }}
              >
                {me.commanderImageUri ? (
                  <img
                    src={me.commanderImageUri}
                    alt={me.commanderName}
                    className="hidden sm:block w-8 h-8 rounded object-cover object-center border border-border shrink-0 cursor-pointer"
                  />
                ) : (
                  <div className="hidden sm:flex w-8 h-8 rounded bg-muted border border-border items-center justify-center text-xs text-muted-foreground shrink-0 cursor-pointer">
                    ?
                  </div>
                )}
                <span className="text-sm font-medium cursor-pointer truncate">
                  {me.commanderName}
                </span>
                {hoveredCard?.name === me.commanderName && (
                  <div
                    ref={hoverCardRef}
                    className="fixed pointer-events-none"
                    style={{ 
                      zIndex: 999999,
                      top: `${cardPosition.top}px`,
                      left: `${cardPosition.left}px`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <div className="bg-popover border rounded-md shadow-xl p-2" style={{ minWidth: "320px" }}>
                      {hoveredCard.imageUri ? (
                        <img
                          src={hoveredCard.imageUri}
                          alt={me.commanderName}
                          style={{ width: "300px", height: "auto", display: "block", maxWidth: "none" }}
                          className="rounded-md"
                        />
                      ) : (
                        <div className="w-[300px] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground p-4">
                          {me.commanderName}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {me.partnerName && (
                <>
                  <span className="text-sm font-medium shrink-0"> // </span>
                  <div
                    className="relative flex items-center min-w-0 pointer-events-none sm:pointer-events-auto"
                    onMouseEnter={(e) => {
                      if (window.matchMedia('(hover: hover)').matches && me.partnerName) {
                        handleCardHover(me.partnerName, e)
                      }
                    }}
                    onMouseLeave={() => {
                      if (window.matchMedia('(hover: hover)').matches) {
                        handleCardLeave()
                      }
                    }}
                  >
                    {me.partnerImageUri ? (
                      <img
                        src={me.partnerImageUri}
                        alt={me.partnerName}
                        className="hidden sm:block w-8 h-8 rounded object-cover object-center border border-border shrink-0 cursor-pointer mr-2"
                      />
                    ) : (
                      <div className="hidden sm:flex w-8 h-8 rounded bg-muted border border-border items-center justify-center text-xs text-muted-foreground shrink-0 cursor-pointer mr-2">
                        ?
                      </div>
                    )}
                    <span className="text-sm font-medium cursor-pointer truncate">
                      {me.partnerName}
                    </span>
                    {hoveredCard?.name === me.partnerName && (
                      <div
                        className="fixed pointer-events-none"
                        style={{ 
                          zIndex: 999999,
                          top: `${cardPosition.top}px`,
                          left: `${cardPosition.left}px`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        <div className="bg-popover border rounded-md shadow-xl p-2" style={{ minWidth: "320px" }}>
                          {hoveredCard.imageUri ? (
                            <img
                              src={hoveredCard.imageUri}
                              alt={me.partnerName}
                              style={{ width: "300px", height: "auto", display: "block", maxWidth: "none" }}
                              className="rounded-md"
                            />
                          ) : (
                            <div className="w-[300px] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground p-4">
                              {me.partnerName}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="hidden sm:inline text-xs">
            Turn {game.winTurn}
          </Badge>
          <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">{game.players.length} players</span>
          <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">{date}</span>
          <ChevronDown
            className={`hidden sm:block h-4 w-4 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}
          />
        </div>
      </div>

      {/* ── Collapsed preview: Commander cards ────────────────────────────────── */}
      

      {/* ── Collapsed preview: Fast mana info ─────────────────────────────────── */}
      
    </div>
  )
}
