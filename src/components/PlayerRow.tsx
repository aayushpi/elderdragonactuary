import { useState } from "react"
import { Trophy, UserPlus, X, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CommanderSearch, extractCardData } from "@/components/CommanderSearch"
import { CommanderCard } from "@/components/CommanderCard"
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
  winTurn: string
  onSetWinner: () => void
  onWinTurnChange: (turn: string) => void
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
  winTurn,
  onSetWinner,
  onWinTurnChange,
  onChange,
  recentCommanders,
  fieldErrors,
  showWinnerError,
}: PlayerRowProps) {
  const [showPartner, setShowPartner] = useState(!!player.partnerName)

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

  const selectedCards = player.fastMana?.cards ?? []

  const ordinalLabels = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"]
  const positionLabel = ordinalLabels[playerOrder - 1] ?? `${playerOrder}th`
  const label = `${positionLabel} Player`

  return (
    <div className={`space-y-3 p-3 rounded-lg border transition-colors bg-card ${isWinner ? "border-primary" : "border-border"} ${isMe ? "border-[3px] border-primary" : "border"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-sm font-semibold">{label}</span>
          {isMe && (
            <span className="inline-flex items-center rounded-md bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5">
              Me
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 sm:hidden">
          <Button
            type="button"
            size="sm"
            variant={isWinner ? "default" : "outline"}
            className={`gap-1.5 text-xs h-7 px-2 ${
              isWinner ? "" : showWinnerError ? "border-destructive text-destructive" : "text-muted-foreground"
            }`}
            onClick={onSetWinner}
          >
            <Trophy className="h-3 w-3" />
            Winner
          </Button>
        </div>

        <div className="hidden sm:flex items-center gap-2 self-end sm:self-auto max-w-full">
          <Button
            type="button"
            size="sm"
            variant={isWinner ? "default" : "outline"}
            className={`gap-1.5 text-xs h-7 px-2 ${
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
        </div>
      </div>

      {isWinner && (
        <div className="flex items-center justify-end gap-1 sm:hidden">
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
        {player.commanderName && (
          <CommanderCard
            commanderName={player.commanderName}
            imageUri={player.commanderImageUri}
            manaCost={player.commanderManaCost}
            typeLine={player.commanderTypeLine}
          />
        )}

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
            {player.partnerName && (
              <CommanderCard
                commanderName={player.partnerName}
                imageUri={player.partnerImageUri}
                manaCost={player.partnerManaCost}
                typeLine={player.partnerTypeLine}
              />
            )}
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
