import { useState } from "react"
import { Trophy, UserPlus, X, Minus, Plus, HelpCircle } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { loadPods, loadProfile } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { InputGroup, InputGroupText } from "@/components/ui/input-group"
import { CommanderSearch } from "@/components/CommanderSearch"
import { extractCardData } from "@/lib/shared"
// CommanderCard removed: using low-opacity background image instead
import { CardSearch } from "@/components/CardSearch"
import { SeatPicker } from "@/components/SeatPicker"
import { Separator } from "@/components/ui/separator"
import { resolveArtCrop } from "@/lib/scryfall"
import type { Player, RecentCommander, SeatPosition, ScryfallCard } from "@/types"

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
  recentCommanders?: RecentCommander[]
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
  recentCommanders,
  fieldErrors,
  showWinnerError,
}: PlayerRowProps) {
  const [showPartner, setShowPartner] = useState(!!player.partnerName)
  const [showSuggestions, setShowSuggestions] = useState(false)

  function handleCommanderChange(name: string, card: ScryfallCard | null) {
    if (card) {
      onChange({ commanderName: name, ...extractCardData(card) })
    } else {
      onChange({ commanderName: name, commanderImageUri: undefined, commanderColorIdentity: undefined, commanderManaCost: undefined, commanderTypeLine: undefined })
    }
  }

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
    const cards = [...(player.fastMana?.cards ?? []), trimmed]
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
                  <InputGroup className="w-40">
                <Input
                  value={player.displayName ?? ""}
                      onChange={(e) => onChange({ displayName: e.target.value })}
                  placeholder={label}
                  className="w-full h-10 bg-transparent border-0 text-sm px-3"
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />
                {isMe && <InputGroupText>Me</InputGroupText>}
              </InputGroup>

                  {/* Suggestions dropdown for existing pod player names (non-me only) */}
                  <div className="absolute left-0 top-full mt-1 z-50 w-40">
                    {(() => {
                      if (isMe || !showSuggestions) return null
                      const pods = loadPods()
                      const profile = loadProfile()
                      const profileName = (profile.displayName ?? "").trim()
                      const cloudNames = profile.playerNames ?? []
                      const allNames = Array.from(new Set([...cloudNames, ...pods.flatMap((p) => p.players)].filter(Boolean)))
                      const q = (player.displayName ?? "").trim().toLowerCase()
                      const candidates = q
                        ? allNames.filter((n) => n.toLowerCase().includes(q))
                        : allNames
                      const filtered = candidates.filter((n) => n.trim() && n.trim() !== profileName)
                      if (!filtered.length) return null
                      return (
                        <div className="rounded-md border bg-popover p-1 shadow-md">
                          {filtered.map((n) => (
                            <button
                              key={n}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                onChange({ displayName: n })
                                setShowSuggestions(false)
                              }}
                              className="w-full text-left px-2 py-1 text-sm hover:bg-accent"
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

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
        <CommanderSearch
          value={player.commanderName ?? ""}
          onChange={handleCommanderChange}
          hasError={fieldErrors?.commanderName}
          recentCommanders={recentCommanders}
          onSelectRecent={(rc) => {
            onChange({
              commanderName: rc.name,
              commanderImageUri: rc.imageUri,
              commanderColorIdentity: rc.colorIdentity,
              commanderManaCost: rc.manaCost,
              commanderTypeLine: rc.typeLine,
            })
          }}
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
        <CardSearch
          selectedCards={selectedCards}
          onAddCard={addFastManaCard}
          onRemoveCard={removeFastManaCard}
          placeholder="Search for fast mana cards…"
        />
      </div>
    </div>
  )
}
