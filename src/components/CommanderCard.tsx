import { useEffect, useRef, useState } from "react"
import { ExternalLink } from "lucide-react"
import { ManaCost } from "@/components/ManaCost"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"
import type { MtgColor } from "@/types"

const imageCache = new Map<string, string | null>()
const hoverImageCache = new Map<string, string | null>()

interface CommanderCardProps {
  commanderName: string
  imageUri?: string
  colorIdentity?: MtgColor[]
  manaCost?: string
  typeLine?: string
  isMe?: boolean
  compact?: boolean
}

export function CommanderCard({
  commanderName,
  imageUri,
  manaCost,
  typeLine,
  compact = false,
}: CommanderCardProps) {
  const [resolvedImageUri, setResolvedImageUri] = useState<string | undefined>(imageUri)
  const [hoveredCard, setHoveredCard] = useState<{ name: string; imageUri?: string } | null>(null)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const activeHoverRef = useRef<string | null>(null)
  const hoverCardRef = useRef<HTMLDivElement>(null)
  const scryfallUrl = `https://scryfall.com/search?q=!"${encodeURIComponent(commanderName)}"`

  useEffect(() => {
    let isCancelled = false

    async function resolveMissingImage() {
      if (imageUri) {
        setResolvedImageUri(imageUri)
        return
      }

      const cached = imageCache.get(commanderName)
      if (cached !== undefined) {
        setResolvedImageUri(cached ?? undefined)
        return
      }

      try {
        const card = await fetchCardByName(commanderName)
        const fetchedImage = resolveArtCrop(card) ?? null
        imageCache.set(commanderName, fetchedImage)
        if (!isCancelled) {
          setResolvedImageUri(fetchedImage ?? undefined)
        }
      } catch {
        imageCache.set(commanderName, null)
        if (!isCancelled) {
          setResolvedImageUri(undefined)
        }
      }
    }

    resolveMissingImage()
    return () => {
      isCancelled = true
    }
  }, [commanderName, imageUri])

  async function handleCardHover(cardName: string, event: React.MouseEvent) {
    if (hoveredCard?.name === cardName) return
    activeHoverRef.current = cardName

    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const distanceFromTop = rect.top
    
    const cardLeft = rect.left + rect.width / 2
    const estimatedCardHeight = 420
    
    if (distanceFromTop < window.innerHeight / 2) {
      setCardPosition({ top: rect.bottom + 8, left: cardLeft })
    } else {
      setCardPosition({ top: rect.top - estimatedCardHeight - 8, left: cardLeft })
    }

    const cached = hoverImageCache.get(cardName)
    if (cached !== undefined) {
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: cached ?? undefined })
      return
    }

    try {
      const card = await fetchCardByName(cardName)
      const imageUri = resolveArtCrop(card)
      hoverImageCache.set(cardName, imageUri ?? null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName, imageUri: imageUri ?? undefined })
    } catch {
      hoverImageCache.set(cardName, null)
      if (activeHoverRef.current !== cardName) return
      setHoveredCard({ name: cardName })
    }
  }

  function handleCardLeave() {
    activeHoverRef.current = null
    setHoveredCard(null)
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 relative cursor-pointer"
        onMouseEnter={(e) => handleCardHover(commanderName, e)}
        onMouseLeave={handleCardLeave}
      >
        {resolvedImageUri ? (
          <img
            src={resolvedImageUri}
            alt={commanderName}
            className="w-8 h-8 rounded object-cover object-center border border-border shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
            ?
          </div>
        )}
        <span className="text-sm font-medium leading-tight truncate">{commanderName}</span>
        {hoveredCard?.name === commanderName && (
          <div
            ref={hoverCardRef}
            className="fixed pointer-events-none"
            style={{ 
              zIndex: 50,
              top: `${cardPosition.top}px`,
              left: `${cardPosition.left}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="bg-popover border rounded-md shadow-xl p-2" style={{ minWidth: "320px" }}>
              {hoveredCard.imageUri ? (
                <img
                  src={hoveredCard.imageUri}
                  alt={commanderName}
                  style={{ width: "300px", height: "auto", display: "block", maxWidth: "none" }}
                  className="rounded-md"
                />
              ) : (
                <div className="w-[300px] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground p-4">
                  {commanderName}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-muted/20">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{commanderName}</span>
          {manaCost && <ManaCost cost={manaCost} size="xs" />}
        </div>
        {typeLine && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{typeLine}</p>
        )}
        <a
          href={scryfallUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline mt-1"
        >
          Scryfall <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      {resolvedImageUri ? (
        <div className="w-16 h-16 rounded overflow-hidden shrink-0 border border-border">
          <img
            src={resolvedImageUri}
            alt={commanderName}
            className="w-full h-full object-cover object-center"
          />
        </div>
      ) : (
        <div className="w-16 h-16 rounded shrink-0 border border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
          No image
        </div>
      )}
    </div>
  )
}
