import { useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ManaCost } from "@/components/ManaCost"
import { useScryfall } from "@/hooks/useScryfall"
import { resolveArtCrop } from "@/lib/scryfall"
import { cn } from "@/lib/utils"
import type { MtgColor, RecentCommander, ScryfallCard } from "@/types"

interface CommanderSearchProps {
  value: string
  onChange: (name: string, card: ScryfallCard | null) => void
  placeholder?: string
  disabled?: boolean
  hasError?: boolean
  recentCommanders?: RecentCommander[]
  onSelectRecent?: (commander: RecentCommander) => void
}

export function CommanderSearch({
  value,
  onChange,
  placeholder = "Search commander…",
  disabled,
  hasError,
  recentCommanders,
  onSelectRecent,
}: CommanderSearchProps) {
  const [open, setOpen] = useState(false)
  const [loadingCard, setLoadingCard] = useState(false)
  const { query, setQuery, suggestions, isLoading, fetchCard } = useScryfall("commander")

  async function handleSelect(name: string) {
    setOpen(false)
    setQuery("")
    setLoadingCard(true)
    const card = await fetchCard(name)
    onChange(name, card)
    setLoadingCard(false)
  }

  function handleSelectRecent(rc: RecentCommander) {
    setOpen(false)
    setQuery("")
    onSelectRecent?.(rc)
  }

  const hasRecents = recentCommanders && recentCommanders.length > 0
  const showRecents = query.length < 2 && hasRecents

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", hasError && "border-destructive")}
          disabled={disabled || loadingCard}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {loadingCard ? "Loading…" : value || placeholder}
          </span>
          {loadingCard ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[480px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a commander name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {/* Recent commanders (shown when query is empty and recents exist) */}
            {showRecents && (
              <CommandGroup heading="Recent">
                {recentCommanders!.map((rc) => (
                  <CommandItem
                    key={rc.name}
                    value={rc.name}
                    onSelect={() => handleSelectRecent(rc)}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === rc.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate text-sm">{rc.name}</span>
                    </div>
                    {rc.manaCost && <ManaCost cost={rc.manaCost} size="xs" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Scryfall search results */}
            {isLoading && query.length >= 2 && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}
            {!isLoading && query.length >= 2 && suggestions.length === 0 && (
              <CommandEmpty>No commanders found.</CommandEmpty>
            )}
            {!isLoading && suggestions.length > 0 && query.length >= 2 && (
              <CommandGroup>
                {suggestions.map((s) => (
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
                          value === s.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate text-sm">{s.name}</span>
                    </div>
                    {s.manaCost && <ManaCost cost={s.manaCost} size="xs" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Fallback prompt when no recents and query too short */}
            {query.length < 2 && !hasRecents && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Type at least 2 characters
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function extractCardData(card: ScryfallCard) {
  return {
    commanderImageUri: resolveArtCrop(card),
    commanderColorIdentity: card.color_identity as MtgColor[],
    commanderManaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? "",
    commanderTypeLine: card.type_line,
  }
}
