import { useState } from "react"
import { Trophy, UserPlus, X, Minus, Plus, HelpCircle, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { loadProfile } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { InputGroup, InputGroupText } from "@/components/ui/input-group"
import { CommanderSearch } from "@/components/CommanderSearch"
import { CommanderPicker, type CommanderShortlistItem } from "@/components/CommanderPicker"
import { PlayerNamePicker } from "@/components/PlayerNamePicker"
// CommanderCard removed: using low-opacity background image instead
import { FastManaPicker } from "@/components/FastManaPicker"
import { Badge } from "@/components/ui/badge"
import { SeatPicker } from "@/components/SeatPicker"
import { Separator } from "@/components/ui/separator"
import { resolveArtCrop } from "@/lib/scryfall"
import type { Player, SeatPosition, ScryfallCard } from "@/types"

interface FieldErrors {
  commanderName?: boolean
  seatPosition?: boolean
  winTurn?: boolean
}

interface PlayerRowProps {
  player: Partial<Player>
  isMe: boolean
  playerOrder: number
  takenSeats: SeatPosition[]
  totalPlayers: number
  isWinner: boolean
  showKoTurnControls: boolean
  winTurn: string
  koTurn: string
  onSetWinner: () => void
  onWinTurnChange: (turn: string) => void
  onKoTurnChange: (turn: string) => void
  onChange: (updated: Partial<Player>) => void
  /** This player's recent commanders (the me-player, or a known pod-mate). Drives
   *  the one-tap CommanderPicker; empty/undefined opens straight into search. */
  shortlist?: CommanderShortlistItem[]
  /** Label shown above the recents list ("You" or a pod-mate's name). */
  pickerLabel?: string
  seatLabel?: string
  knownPlayerNames?: string[]
  fieldErrors?: FieldErrors
  showWinnerError?: boolean
}

export function PlayerRow({
  player,
  isMe,
  playerOrder,
  takenSeats,
  totalPlayers,
  isWinner,
  showKoTurnControls,
  winTurn,
  koTurn,
  onSetWinner,
  onWinTurnChange,
  onKoTurnChange,
  onChange,
  shortlist,
  pickerLabel,
  seatLabel,
  knownPlayerNames,
  fieldErrors,
  showWinnerError,
}: PlayerRowProps) {
  const [showPartner, setShowPartner] = useState(!!player.partnerName)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [namePickerOpen, setNamePickerOpen] = useState(false)
  const [fastManaPickerOpen, setFastManaPickerOpen] = useState(false)

  // Saved opponent names this player can be picked from — exclude the logged-in
  // user's own name so it never shows up as a pickable opponent.
  const savedOpponentNames = (() => {
    if (isMe || !knownPlayerNames?.length) return []
    const profileName = (loadProfile().displayName ?? "").trim()
    return knownPlayerNames.filter((n) => n.trim() && n.trim() !== profileName)
  })()

  function handlePartnerChange(name: string, card: ScryfallCard | null) {
    if (card) {
      onChange({
        partnerName: name,
        partnerImageUri: resolveArtCrop(card),
        partnerManaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? "",
        partnerTypeLine: card.type_line,
      })
    } else {
      onChange({ partnerName: name, partnerImageUri: undefined, partnerManaCost: undefined, partnerTypeLine: undefined })
    }
  }

  function handleRemovePartner() {
    setShowPartner(false)
    onChange({ partnerName: undefined, partnerImageUri: undefined, partnerManaCost: undefined, partnerTypeLine: undefined })
  }

  function addFastManaCard(card: string) {
    const trimmed = card.trim()
    if (!trimmed) return
    const existing = player.fastMana?.cards ?? []
    if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return
    const cards = [...existing, trimmed]
    onChange({ fastMana: { hasFastMana: true, cards } })
  }

  function removeFastManaCard(card: string) {
    const cards = (player.fastMana?.cards ?? []).filter((c) => c !== card)
    onChange({ fastMana: { hasFastMana: cards.length > 0, cards } })
  }

  function incrementTurn() {
    const currentTurn = parseInt(winTurn) || 0
    onWinTurnChange((currentTurn + 1).toString())
  }

  function decrementTurn() {
    const currentTurn = parseInt(winTurn) || 1
    if (currentTurn > 1) {
      onWinTurnChange((currentTurn - 1).toString())
    }
  }

  function incrementKoTurn() {
    const currentTurn = parseInt(koTurn) || 0
    onKoTurnChange((currentTurn + 1).toString())
  }

  function decrementKoTurn() {
    const currentTurn = parseInt(koTurn) || 1
    if (currentTurn > 1) {
      onKoTurnChange((currentTurn - 1).toString())
    }
  }

  const selectedCards = player.fastMana?.cards ?? []

  const ordinalLabels = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"]
  const positionLabel = ordinalLabels[playerOrder - 1] ?? `${playerOrder}th`
  const label = `${positionLabel} Player`

  return (
    <div className={`relative space-y-3 p-3 rounded-lg border transition-colors ${isWinner ? "border-primary" : "border-border"} ${isMe ? "border-[3px] border-primary" : "border"} overflow-hidden bg-card`}>
      {player.commanderImageUri && (
        <img
          src={player.commanderImageUri}
          alt={`${player.commanderName} art`}
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
        />
      )}
      
      <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center justify-center gap-2 pt-0.5 sm:justify-start">
          <FormField>
                <div className="flex items-center gap-2 relative">
                  {isMe ? (
                    <InputGroup className="w-40">
                      <Input
                        value={player.displayName ?? ""}
                        onChange={(e) => onChange({ displayName: e.target.value })}
                        placeholder={label}
                        className="w-full h-10 bg-transparent border-0 text-sm px-3"
                      />
                      <InputGroupText>Me</InputGroupText>
                    </InputGroup>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setNamePickerOpen(true)}
                        className="flex h-10 w-40 items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className={cn("truncate", !player.displayName && "text-muted-foreground")}>
                          {player.displayName?.trim() || label}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                      <PlayerNamePicker
                        open={namePickerOpen}
                        onOpenChange={setNamePickerOpen}
                        names={savedOpponentNames}
                        value={player.displayName?.trim()}
                        seatLabel={seatLabel}
                        onPick={(name) => onChange({ displayName: name })}
                      />
                    </>
                  )}

                  <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="p-0" aria-label="Player name info">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="text-sm">
                    Adding names for each player will save this game as a pod and makes starting games with these players simpler. A pod is only saved if all names are entered!
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </FormField>
        </div>

        <div className="hidden sm:flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto max-w-full">
          <Button
            type="button"
            variant={isWinner ? "default" : "outline"}
            className={`gap-1.5 text-sm h-10 px-3 ${
              isWinner ? "" : showWinnerError ? "border-destructive text-destructive" : "text-muted-foreground"
            }`}
            onClick={onSetWinner}
          >
            <Trophy className="h-3 w-3" />
            Winner
          </Button>
          {isWinner && (
            <div className="flex items-center gap-1 justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                onClick={decrementTurn}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={1}
                max={50}
                placeholder="turn"
                value={winTurn}
                onChange={(e) => onWinTurnChange(e.target.value)}
                className={`w-20 h-10 text-sm text-center ${fieldErrors?.winTurn ? "border-destructive" : ""}`}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                onClick={incrementTurn}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
          {!isWinner && showKoTurnControls && (
            <div className="flex items-center gap-1 justify-end">
              <span className="text-xs text-muted-foreground uppercase tracking-wide px-1">KO</span>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                onClick={decrementKoTurn}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={1}
                max={50}
                placeholder="turn"
                value={koTurn}
                onChange={(e) => onKoTurnChange(e.target.value)}
                className="w-20 h-10 text-sm text-center"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                onClick={incrementKoTurn}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile winner controls */}
      <div className="flex items-center justify-center gap-2 sm:hidden">
        <Button
          type="button"
          variant={isWinner ? "default" : "outline"}
          className={`gap-1.5 text-sm h-10 px-3 ${
            isWinner ? "" : showWinnerError ? "border-destructive text-destructive" : "text-muted-foreground"
          }`}
          onClick={onSetWinner}
        >
          <Trophy className="h-3 w-3" />
          Winner
        </Button>
      </div>

      {isWinner && (
        <div className="flex items-center justify-center gap-1 sm:hidden">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={decrementTurn}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            min={1}
            max={50}
            placeholder="turn"
            value={winTurn}
            onChange={(e) => onWinTurnChange(e.target.value)}
            className={`w-14 h-7 text-sm text-center ${fieldErrors?.winTurn ? "border-destructive" : ""}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={incrementTurn}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {!isWinner && showKoTurnControls && (
        <div className="flex items-center justify-center gap-1 sm:hidden">
          <span className="text-xs text-muted-foreground uppercase tracking-wide px-1">KO</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={decrementKoTurn}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            min={1}
            max={50}
            placeholder="turn"
            value={koTurn}
            onChange={(e) => onKoTurnChange(e.target.value)}
            className="w-14 h-7 text-sm text-center"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={incrementKoTurn}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Commander */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wide">Commander</label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            fieldErrors?.commanderName ? "border-destructive" : "border-input"
          )}
        >
          <span className={cn("truncate", !player.commanderName && "text-muted-foreground")}>
            {player.commanderName || "Pick a commander"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <CommanderPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          seatLabel={seatLabel}
          contextLabel="logging a new game"
          label={pickerLabel ?? (isMe ? "You" : "Player")}
          value={player.commanderName}
          items={shortlist ?? []}
          onPick={(pick) => onChange(pick)}
        />

        {/* Partner */}
        {player.commanderName && !showPartner && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
            onClick={() => setShowPartner(true)}
          >
            <UserPlus className="h-3 w-3" />
            Add partner
          </button>
        )}
        {showPartner && (
          <div className="space-y-1.5 border-t border-dashed border-border pt-2 mt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Partner</label>
              <button
                type="button"
                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleRemovePartner}
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            </div>
            <CommanderSearch
              value={player.partnerName ?? ""}
              onChange={handlePartnerChange}
              placeholder="Search partner…"
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Seat */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wide">Seat (turn order)</label>
        <SeatPicker
          value={player.seatPosition ?? null}
          onChange={(seat) => onChange({ seatPosition: seat ?? undefined })}
          takenSeats={takenSeats}
          totalPlayers={totalPlayers}
          hasError={fieldErrors?.seatPosition}
        />
      </div>

      <Separator />

      {/* Fast mana */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wide">Fast Mana</label>
        {selectedCards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCards.map((card) => (
              <Badge key={card} variant="secondary" className="flex items-center gap-1">
                {card}
                <button
                  type="button"
                  onClick={() => removeFastManaCard(card)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label={`Remove ${card}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setFastManaPickerOpen(true)}
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn(selectedCards.length === 0 && "text-muted-foreground")}>
            {selectedCards.length === 0
              ? "Add fast mana"
              : `${selectedCards.length} card${selectedCards.length > 1 ? "s" : ""} · add more`}
          </span>
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <FastManaPicker
          open={fastManaPickerOpen}
          onOpenChange={setFastManaPickerOpen}
          seatLabel={seatLabel}
          selectedCards={selectedCards}
          onAdd={addFastManaCard}
          onRemove={removeFastManaCard}
        />
      </div>
    </div>
  )
}
