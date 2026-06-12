import { Pencil } from "lucide-react"
import type { Game, MtgColor } from "@/types"
import { Pips, ResultBadge } from "@/components/modern/primitives"

interface GameRowProps {
  game: Game
  onEdit?: (id: string) => void
}

export function GameRow({ game, onEdit }: GameRowProps) {
  const me = game.players.find((p) => p.isMe)
  const won = !!me && game.winnerId === me.id
  const cmdr = me?.commanderName ?? "Unknown commander"
  const colors = (me?.commanderColorIdentity ?? []) as MtgColor[]
  const seat = me?.seatPosition
  const vs = game.players
    .filter((p) => !p.isMe)
    .map((p) => p.commanderName.split(" // ")[0].split(",")[0])
    .join(" · ")
  const date = new Date(game.playedAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="group flex items-center gap-3 px-4 py-3.5 sm:px-5 hover:bg-muted/60 transition-colors">
      <div className="w-14 shrink-0">
        <ResultBadge won={won} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{cmdr}</span>
          {colors.length > 0 && (
            <span className="hidden sm:inline-flex">
              <Pips colors={colors} />
            </span>
          )}
        </div>
        {vs && <div className="mt-0.5 text-xs text-muted-foreground truncate">vs {vs}</div>}
      </div>
      <div className="hidden sm:block shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular leading-5">
        <div>{date}</div>
        <div>
          {seat ? `seat ${seat} · ` : ""}
          {game.winTurn} turns
        </div>
      </div>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit(game.id)
          }}
          className="h-9 w-9 grid place-items-center rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Edit game"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
