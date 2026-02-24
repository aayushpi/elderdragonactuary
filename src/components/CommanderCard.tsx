import { ExternalLink } from "lucide-react"
import { ManaCost } from "@/components/ManaCost"
import type { MtgColor } from "@/types"

interface CommanderCardProps {
  commanderName: string
  imageUri?: string
  colorIdentity?: MtgColor[]
  manaCost?: string
  typeLine?: string
  isMe?: boolean
  compact?: boolean
}

export function CommanderCard({
  commanderName,
  imageUri,
  manaCost,
  typeLine,
  compact = false,
}: CommanderCardProps) {
  const scryfallUrl = `https://scryfall.com/search?q=!"${encodeURIComponent(commanderName)}"`

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {imageUri ? (
          <img
            src={imageUri}
            alt={commanderName}
            className="w-8 h-8 rounded object-cover object-center border border-border shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
            ?
          </div>
        )}
        <span className="text-sm font-medium leading-tight truncate">{commanderName}</span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-muted/20">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{commanderName}</span>
          {manaCost && <ManaCost cost={manaCost} size="xs" />}
        </div>
        {typeLine && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{typeLine}</p>
        )}
        <a
          href={scryfallUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline mt-1"
        >
          Scryfall <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      {imageUri && (
        <div className="w-16 h-16 rounded overflow-hidden shrink-0 border border-border">
          <img
            src={imageUri}
            alt={commanderName}
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}
    </div>
  )
}
