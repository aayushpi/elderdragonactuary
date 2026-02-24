import { useState } from "react"
import { Trophy, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { CommanderSearch, extractCardData } from "@/components/CommanderSearch"
import { CommanderCard } from "@/components/CommanderCard"
import { SeatPicker } from "@/components/SeatPicker"
import { Separator } from "@/components/ui/separator"
import { resolveArtCrop } from "@/lib/scryfall"
import type { Player, RecentCommander, SeatPosition, ScryfallCard } from "@/types"

const FAST_MANA_CARDS = [
  "Sol Ring", "Mana Crypt", "Mana Vault", "Chrome Mox", "Mox Diamond",
  "Jeweled Lotus", "Lotus Petal", "Arcane Signet", "Fellwar Stone",
  "Dark Ritual", "Cabal Ritual", "Elvish Spirit Guide", "Simian Spirit Guide",
  "Mox Amber", "Mox Opal", "Grim Monolith", "Basalt Monolith",
  "Ancient Tomb", "City of Traitors",
]

interface FieldErrors {
  commanderName?: boolean
  seatPosition?: boolean
  winTurn?: boolean
}

interface PlayerRowProps {
  player: Partial<Player>
  isMe: boolean
  opponentIndex?: number
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
  opponentIndex,
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
  const [fastManaSearch, setFastManaSearch] = useState("")

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
        partnerManaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
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

  function handleFastManaToggle(checked: boolean) {
    if (!checked) setFastManaSearch("")
    onChange({ fastMana: { hasFastMana: checked, cards: checked ? (player.fastMana?.cards ?? []) : [] } })
  }

  function addFastManaCard(card: string) {
    const trimmed = card.trim()
    if (!trimmed) return
    const cards = [...(player.fastMana?.cards ?? []), trimmed]
    onChange({ fastMana: { hasFastMana: true, cards } })
    setFastManaSearch("")
  }

  function removeFastManaCard(card: string) {
    const cards = (player.fastMana?.cards ?? []).filter((c) => c !== card)
    onChange({ fastMana: { hasFastMana: player.fastMana?.hasFastMana ?? false, cards } })
  }

  const selectedCards = player.fastMana?.cards ?? []
  const filteredSuggestions = fastManaSearch.length > 0
    ? FAST_MANA_CARDS.filter(
        (c) => c.toLowerCase().includes(fastManaSearch.toLowerCase()) && !selectedCards.includes(c)
      ).slice(0, 6)
    : []

  const label = isMe ? "Me" : `Opponent ${opponentIndex}`

  return (
    <div className={`space-y-3 p-3 rounded-lg border bg-card transition-colors ${isWinner ? "border-primary" : "border-border"}`}>
      {/* Label */}
      <span className="text-sm font-semibold">{label}</span>

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
          onChange={(seat: SeatPosition) => onChange({ seatPosition: seat })}
          takenSeats={takenSeats}
          totalPlayers={totalPlayers}
          hasError={fieldErrors?.seatPosition}
        />
      </div>

      <Separator />

      {/* Winner */}
      <div className="flex items-center gap-2">
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
          <Input
            type="number"
            min={1}
            max={50}
            placeholder="turn"
            value={winTurn}
            onChange={(e) => onWinTurnChange(e.target.value)}
            className={`w-20 h-7 text-sm ${fieldErrors?.winTurn ? "border-destructive" : ""}`}
          />
        )}
      </div>

      <Separator />

      {/* Fast mana */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Switch
            checked={player.fastMana?.hasFastMana ?? false}
            onCheckedChange={handleFastManaToggle}
          />
          <label className="text-xs text-muted-foreground cursor-pointer">Fast mana</label>
        </div>

        {player.fastMana?.hasFastMana && (
          <div className="space-y-1.5">
            {selectedCards.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedCards.map((card) => (
                  <span
                    key={card}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
                  >
                    {card}
                    <button
                      type="button"
                      onClick={() => removeFastManaCard(card)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Input
                placeholder="Add card…"
                value={fastManaSearch}
                onChange={(e) => setFastManaSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addFastManaCard(fastManaSearch) }
                  if (e.key === "Escape") setFastManaSearch("")
                }}
                className="text-sm h-8"
              />
              {filteredSuggestions.length > 0 && (
                <div className="absolute z-20 w-full bg-popover border border-border rounded-md shadow-md mt-1 overflow-hidden">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(e) => { e.preventDefault(); addFastManaCard(s) }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
