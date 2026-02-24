import { useState, useRef, useEffect } from "react"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useScryfall } from "@/hooks/useScryfall"
import { cn } from "@/lib/utils"

interface CardSearchProps {
  selectedCards: string[]
  onAddCard: (cardName: string) => void
  onRemoveCard: (cardName: string) => void
  placeholder?: string
  disabled?: boolean
}

export function CardSearch({
  selectedCards,
  onAddCard,
  onRemoveCard,
  placeholder = "Search for a card…",
  disabled,
}: CardSearchProps) {
  const [open, setOpen] = useState(false)
  const { query, setQuery, suggestions, isLoading, fetchCard } = useScryfall("card")
  const inputRef = useRef<HTMLInputElement>(null)
  const [hoveredCard, setHoveredCard] = useState<{ name: string; imageUri?: string } | null>(null)
  const [hoverPosition, setHoverPosition] = useState<'top' | 'bottom'>('bottom')
  const hoverCardRef = useRef<HTMLDivElement>(null)

  async function handleSelect(cardName: string) {
    if (!selectedCards.includes(cardName)) {
      onAddCard(cardName)
    }
    setQuery("")
    // Keep dropdown open and refocus input for quick successive adds
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  async function handleCardHover(cardName: string) {
    if (hoveredCard?.name === cardName) return

    try {
      const card = await fetchCard(cardName)
      if (card) {
        const imageUri = card.image_uris?.large || card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.large || card.card_faces?.[0]?.image_uris?.normal
        setHoveredCard({ name: cardName, imageUri })
      }
    } catch {
      setHoveredCard({ name: cardName })
    }
  }

  function handleCardLeave() {
    setHoveredCard(null)
  }

  // Calculate hover card position to ensure it's always visible
  useEffect(() => {
    if (hoveredCard && hoverCardRef.current) {
      const rect = hoverCardRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const cardHeight = 400 // Approximate height of card image
      
      // If there's not enough space below, show above
      if (rect.bottom + cardHeight > viewportHeight) {
        setHoverPosition('top')
      } else {
        setHoverPosition('bottom')
      }
    }
  }, [hoveredCard])

  function handleOpenChange(open: boolean) {
    setOpen(open)
    if (open) {
      // Focus input when dropdown opens
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }

  const filteredSuggestions = suggestions.filter(s => !selectedCards.includes(s.name))

  return (
    <div className="space-y-3 relative">
      {/* Selected cards tags - show above input */}
      {selectedCards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCards.map((cardName) => (
            <div key={cardName} className="relative">
              <div
                onMouseEnter={() => handleCardHover(cardName)}
                onMouseLeave={handleCardLeave}
                className="inline-block"
              >
                <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80">
                  {cardName}
                  <button
                    type="button"
                    onClick={() => onRemoveCard(cardName)}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>

              {/* Hover card */}
              {hoveredCard?.name === cardName && (
                <div 
                  ref={hoverCardRef}
                  className={`absolute z-[9999] ${hoverPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 transform -translate-x-1/2`}
                  style={{ zIndex: 9999 }}
                >
                  <div 
                    className="bg-popover border rounded-md shadow-lg p-2"
                    style={{ minWidth: '320px' }}
                  >
                    {hoveredCard.imageUri ? (
                      <img
                        src={hoveredCard.imageUri}
                        alt={cardName}
                        style={{ 
                          width: '300px !important', 
                          height: 'auto !important', 
                          maxWidth: 'none !important',
                          display: 'block'
                        }}
                        className="rounded-md"
                        onError={() => {
                          // Fallback if image fails to load
                          setHoveredCard({ name: cardName })
                        }}
                      />
                    ) : (
                      <div style={{ width: '400px', height: 'auto' }} className="flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground p-4">
                        {cardName}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={handleOpenChange} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="truncate text-muted-foreground">
              {placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[480px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              ref={inputRef}
              placeholder="Type a card name…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isLoading && query.length >= 2 && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}
              {!isLoading && query.length >= 2 && filteredSuggestions.length === 0 && (
                <CommandEmpty>No cards found.</CommandEmpty>
              )}
              {!isLoading && filteredSuggestions.length > 0 && query.length >= 2 && (
                <CommandGroup>
                  {filteredSuggestions.map((s) => (
                    <CommandItem
                      key={s.name}
                      value={s.name}
                      onSelect={() => handleSelect(s.name)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            selectedCards.includes(s.name) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate text-sm">{s.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {query.length < 2 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Type at least 2 characters
                </p>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}