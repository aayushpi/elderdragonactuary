import { useState } from "react"
import { X, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CommanderSearch } from "@/components/CommanderSearch"
import { resolveArtCrop } from "@/lib/scryfall"
import { cn } from "@/lib/utils"
import type { RecentCommander, ScryfallCard, SeatPosition } from "@/types"

interface CommanderEditModalProps {
  seatLabel: string
  commanderName: string
  commanderImageUri?: string
  displayName?: string
  seatPosition: SeatPosition
  totalSeats: number
  knownPlayerNames: string[]
  recentMyCommanders: RecentCommander[]
  myDisplayName?: string
  hasPrev: boolean
  hasNext: boolean
  onSave: (updates: {
    commanderName: string
    commanderImageUri?: string
    displayName?: string
    isMe: boolean
    seatPosition: SeatPosition
  }) => void
  onSaveAndPrev: (updates: {
    commanderName: string
    commanderImageUri?: string
    displayName?: string
    isMe: boolean
    seatPosition: SeatPosition
  }) => void
  onSaveAndNext: (updates: {
    commanderName: string
    commanderImageUri?: string
    displayName?: string
    isMe: boolean
    seatPosition: SeatPosition
  }) => void
  onCancel: () => void
}

export function CommanderEditModal({
  seatLabel,
  commanderName,
  commanderImageUri,
  displayName,
  seatPosition,
  totalSeats,
  knownPlayerNames,
  recentMyCommanders,
  myDisplayName,
  hasPrev,
  hasNext,
  onSave,
  onSaveAndPrev,
  onSaveAndNext,
  onCancel,
}: CommanderEditModalProps) {
  const [pendingCommander, setPendingCommander] = useState(commanderName)
  const [pendingImageUri, setPendingImageUri] = useState<string | undefined>(commanderImageUri)
  const [nameQuery, setNameQuery] = useState(displayName ?? "")
  const [namePickerOpen, setNamePickerOpen] = useState(false)
  const [pendingSeat, setPendingSeat] = useState<SeatPosition>(seatPosition)
  const [isMe, setIsMe] = useState(
    !!myDisplayName && (displayName ?? "").trim() === myDisplayName
  )

  function buildUpdates() {
    return {
      commanderName: pendingCommander,
      commanderImageUri: pendingImageUri,
      displayName: nameQuery.trim() || undefined,
      isMe,
      seatPosition: pendingSeat,
    }
  }

  function handleCommanderChange(name: string, card: ScryfallCard | null) {
    setPendingCommander(name)
    setPendingImageUri(card ? resolveArtCrop(card) : undefined)
  }

  function handleSelectRecent(rc: RecentCommander) {
    setPendingCommander(rc.name)
    setPendingImageUri(rc.imageUri)
  }

  function handleNameSelect(name: string) {
    setNameQuery(name)
    setNamePickerOpen(false)
    if (myDisplayName && name === myDisplayName) setIsMe(true)
  }

  const filteredNames = knownPlayerNames.filter((n) =>
    n.toLowerCase().includes(nameQuery.toLowerCase())
  )

  const seatNumbers = Array.from({ length: totalSeats }, (_, i) => (i + 1) as SeatPosition)

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl w-full max-w-sm mx-4 shadow-2xl flex flex-col max-h-[90svh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-semibold text-base">{seatLabel}</p>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 space-y-4 overflow-y-auto">

          {/* Seat picker */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Seat</p>
            <div className="flex gap-2">
              {seatNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPendingSeat(n)}
                  className={cn(
                    "flex-1 h-9 rounded-md border text-sm font-semibold transition-colors",
                    pendingSeat === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:text-foreground hover:border-foreground/40"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Name picker */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Player name{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <div className="flex items-center gap-2">
              <Popover open={namePickerOpen} onOpenChange={setNamePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={namePickerOpen}
                    className="flex-1 justify-between font-normal"
                  >
                    <span className={cn("truncate", !nameQuery && "text-muted-foreground")}>
                      {nameQuery || "Select or type a name…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type a name…"
                      value={nameQuery}
                      onValueChange={setNameQuery}
                    />
                    <CommandList>
                      {filteredNames.length > 0 ? (
                        <CommandGroup>
                          {filteredNames.map((name) => (
                            <CommandItem
                              key={name}
                              value={name}
                              onSelect={() => handleNameSelect(name)}
                            >
                              {name}
                              {name === myDisplayName && (
                                <span className="ml-auto text-xs text-muted-foreground">you</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ) : nameQuery.length > 0 ? (
                        <CommandEmpty>Will use &ldquo;{nameQuery}&rdquo;</CommandEmpty>
                      ) : (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No saved players yet
                        </p>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <button
                type="button"
                onClick={() => setIsMe((v) => !v)}
                className={cn(
                  "h-10 shrink-0 px-3 rounded-md border text-xs font-semibold transition-colors",
                  isMe
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-input hover:text-foreground hover:border-foreground/40"
                )}
              >
                Me
              </button>
            </div>
            {isMe && (
              <p className="text-xs text-primary font-medium">
                Your commanders will appear as quick picks below
              </p>
            )}
          </div>

          {/* Commander search */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Commander</p>
            <CommanderSearch
              value={pendingCommander}
              onChange={handleCommanderChange}
              placeholder="Select commander…"
              recentCommanders={isMe ? recentMyCommanders : undefined}
              onSelectRecent={isMe ? handleSelectRecent : undefined}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex items-center gap-2">
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <div className="flex-1" />
          {hasPrev && (
            <Button variant="outline" size="sm" onClick={() => onSaveAndPrev(buildUpdates())} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
          )}
          {hasNext ? (
            <Button size="sm" onClick={() => onSaveAndNext(buildUpdates())} className="gap-1">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => onSave(buildUpdates())}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
