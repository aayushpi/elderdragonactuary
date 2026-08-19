import type { Game } from "@/types"
import type { DeviceKind, GameShapeProps } from "./events"

function deviceKind(): DeviceKind {
  if (typeof navigator === "undefined") return "desktop"
  return /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
}

/**
 * Reduces a logged game to the shape properties we report on. Deliberately
 * drops commander names, notes and player display names — the aggregate story
 * (pod size, game length, who won) is what the funnels need, and the rest is
 * either free text or identifies the user's real-life playgroup.
 */
export function gameShapeProps(game: Game): GameShapeProps {
  const me = game.players.find((p) => p.isMe)
  return {
    pod_size: game.players.length,
    win_turn: game.winTurn,
    is_win: Boolean(me && game.winnerId === me.id),
    has_partners: game.players.some((p) => Boolean(p.partnerName)),
    fast_mana_used: game.players.some((p) => Boolean(p.fastMana?.hasFastMana)),
    bracket: game.bracket ?? null,
    win_conditions_count: game.winConditions?.length ?? 0,
    device: deviceKind(),
  }
}
