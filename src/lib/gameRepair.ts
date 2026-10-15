import type { Game, MtgColor, Player, ScryfallCard } from "@/types"
import { resolveArtCrop } from "@/lib/scryfall"

type CardLookup = (name: string) => Promise<ScryfallCard>

/** Fills card data older games never stored: my commander's art, and every
 *  partner's color identity (needed for deck color stats) and art. Returns the
 *  repaired players, or null when nothing needed fixing. */
export async function repairGamePlayers(game: Game, lookup: CardLookup): Promise<Player[] | null> {
  let changed = false
  const players = await Promise.all(
    game.players.map(async (p) => {
      let next = p
      if (p.isMe && p.commanderName && !p.commanderImageUri) {
        const card = await lookup(p.commanderName).catch(() => null)
        const uri = card ? resolveArtCrop(card) : undefined
        if (uri) next = { ...next, commanderImageUri: uri }
      }
      if (p.partnerName?.trim() && !p.partnerColorIdentity) {
        const card = await lookup(p.partnerName).catch(() => null)
        if (card) {
          next = {
            ...next,
            partnerColorIdentity: card.color_identity as MtgColor[],
            partnerImageUri: next.partnerImageUri ?? resolveArtCrop(card),
            partnerTypeLine: next.partnerTypeLine ?? card.type_line,
            partnerManaCost: next.partnerManaCost ?? card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
          }
        }
      }
      if (next !== p) changed = true
      return next
    })
  )
  return changed ? players : null
}

export function needsRepair(game: Game): boolean {
  return game.players.some(
    (p) =>
      (p.isMe && p.commanderName && !p.commanderImageUri) ||
      (p.partnerName?.trim() && !p.partnerColorIdentity)
  )
}
