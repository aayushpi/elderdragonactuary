import { useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CommanderCard } from "@/components/CommanderCard"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import { Pencil, Trash2 } from "lucide-react"
import type { Game } from "@/types"

const fastManaImageCache = new Map<string, string | null>()

interface GameDetailPanelProps {
  game: Game | undefined
  onEdit?: () => void
  onDelete?: () => void
}

export function GameDetailPanel({ game, onEdit, onDelete }: GameDetailPanelProps) {
  // Fast mana card hover state
  const [hoveredCard, setHoveredCard] = useState<{ name: string; imageUri?: string } | null>(null)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const activeHoverRef = useRef<string | null>(null)
  const hoverCardRef = useRef<HTMLDivElement>(null)

  if (!game) return null

  // ── Sort players by seat position ────────────────────────────────────────────────────────────────────────
  const sortedPlayers = [...game.players]
    .filter((p) => !p.isMe)
    .sort((a, b) => (a.seatPosition ?? 99) - (b.seatPosition ?? 99))
  
  const winner = game.players.find((p) => p.id === game.winnerId)

  function getMobileMdfcFrontName(name: string) {
    return name.includes(" // ") ? name.split(" // ")[0] : name
  }

  async function handleCardHover(cardName: string, event: React.MouseEvent) {
    if (hoveredCard?.name === cardName) return
    activeHoverRef.current = cardName

    // Determine position based on distance from top of viewport
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const distanceFromTop = rect.top
    
    const cardLeft = rect.left + rect.width / 2
    const estimatedCardHeight = 420
    
    // If we're in the top half of the viewport, show below; otherwise show above
    if (distanceFromTop < window.innerHeight / 2) {
      setCardPosition({ top: rect.bottom + 8, left: cardLeft })
    } else {
      setCardPosition({ top: rect.top - estimatedCardHeight - 8, left: cardLeft })
    }

    const cached = fastManaImageCache.get(cardName)
    if (cached !== undefined) {
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: cached ?? undefined })
      return
    }

    try {
      const card = await fetchCardByName(cardName)
      // Use full-card PNG for fast-mana hover previews so users can read card text
      const imageUri = resolvePng(card) ?? resolveArtCrop(card)
      fastManaImageCache.set(cardName, imageUri ?? null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: imageUri ?? undefined })
    } catch {
      fastManaImageCache.set(cardName, null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName })
    }
  }

  function handleCardLeave() {
    activeHoverRef.current = null
    setHoveredCard(null)
  }

  const winnerHasFastMana = winner?.fastMana.hasFastMana && winner.fastMana.cards.length > 0

  return (
    <div className="space-y-4">
      {/* ── Opponents with seat positions and commanders ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Opponents</p>
        {sortedPlayers.map((player) => (
          <div key={player.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="space-y-1">
                  <CommanderCard
                    commanderName={player.commanderName}
                    mobileDisplayName={getMobileMdfcFrontName(player.commanderName)}
                    imageUri={player.commanderImageUri}
                    compact
                  />
                  {player.partnerName && (
                    <CommanderCard
                      commanderName={player.partnerName}
                      mobileDisplayName={getMobileMdfcFrontName(player.partnerName)}
                      imageUri={player.partnerImageUri}
                      compact
                    />
                  )}
                </div>
                {game.winnerId === player.id && (
                  <Badge className="text-xs shrink-0">Win</Badge>
                )}
                {game.winnerId !== player.id && typeof player.knockoutTurn === "number" && (
                  <Badge variant="outline" className="text-xs shrink-0">KO ON TURN {player.knockoutTurn}</Badge>
                )}
              </div>
            </div>
            {player.fastMana.hasFastMana && (
              <p className="text-xs text-muted-foreground ml-2">
                Fast mana{player.fastMana.cards.length > 0 ? `: ${player.fastMana.cards.join(", ")}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Optional: Game notes ────────────────────────────────────────────────────────────────────────── */}
      {game.notes && (
        <>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm">{game.notes}</p>
          </div>
        </>
      )}

      {/* ── Optional: Win conditions and fast mana ─────────────────────────────────────────────────────────── */}
      {((game.winConditions && game.winConditions.length > 0) || winnerHasFastMana) && (
        <>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Win conditions column */}
            {game.winConditions && game.winConditions.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Win Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {game.winConditions.map((condition) => (
                    <Badge key={condition} variant="outline" className="text-xs">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Fast mana column */}
            {winnerHasFastMana && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Winner's Fast Mana</p>
                <div className="flex flex-wrap gap-1">
                  {winner!.fastMana.cards.map((cardName) => (
                    <div
                      key={cardName}
                      className="relative"
                      onMouseEnter={(e) => handleCardHover(cardName, e)}
                      onMouseLeave={handleCardLeave}
                    >
                      <Badge variant="secondary" className="text-xs cursor-pointer">
                        {cardName}
                      </Badge>

                      {hoveredCard?.name === cardName && (
                        <div
                          ref={hoverCardRef}
                          className="fixed pointer-events-none"
                          style={{ 
                            zIndex: 9999,
                            top: `${cardPosition.top}px`,
                            left: `${cardPosition.left}px`,
                            transform: 'translateX(-50%)'
                          }}
                        >
                          <div className="bg-popover border rounded-md shadow-xl p-2" style={{ minWidth: "320px" }}>
                            {hoveredCard.imageUri ? (
                              <img
                                src={hoveredCard.imageUri}
                                alt={cardName}
                                style={{ width: "300px", height: "auto", display: "block", maxWidth: "none" }}
                                className="rounded-md"
                              />
                            ) : (
                              <div className="w-[300px] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground p-4">
                                {cardName}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Game Info (Turn & Bracket) ─────────────────────────────────────────────────────────────────── */}
      <Separator />
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="text-xs">
          Turn {game.winTurn}
        </Badge>
        {game.bracket && (
          <Badge variant="secondary" className="text-xs">
            Bracket {game.bracket}
          </Badge>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────────────────────────────────── */}
      {(onEdit || onDelete) && (
        <>
          <Separator />
          <div className="flex gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onEdit}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Game
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Game
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
