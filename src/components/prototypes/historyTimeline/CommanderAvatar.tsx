import { useEffect, useState } from "react"
import { fetchCardByName, resolveArtCrop } from "@/lib/scryfall"

const artCache = new Map<string, string | null>()

interface CommanderAvatarProps {
  name?: string
  imageUri?: string
  size?: number
}

/**
 * Small circular avatar showing a commander's Scryfall art crop. Resolves
 * through the scryfall lib layer (same approach as GameHistoryRow) and caches
 * by name so repeated rows don't refetch. Falls back to the first letter.
 */
export function CommanderAvatar({ name, imageUri, size = 36 }: CommanderAvatarProps) {
  const [src, setSrc] = useState<string | undefined>(
    imageUri && imageUri.includes("art_crop") ? imageUri : undefined
  )

  useEffect(() => {
    let cancelled = false
    if (!name) return

    if (imageUri && imageUri.includes("art_crop")) {
      setSrc(imageUri)
      return
    }
    const cached = artCache.get(name)
    if (cached !== undefined) {
      setSrc(cached ?? undefined)
      return
    }

    fetchCardByName(name)
      .then((card) => {
        const uri = resolveArtCrop(card) ?? imageUri
        artCache.set(name, uri ?? null)
        if (!cancelled) setSrc(uri ?? undefined)
      })
      .catch(() => {
        artCache.set(name, null)
        if (!cancelled) setSrc(imageUri)
      })

    return () => {
      cancelled = true
    }
  }, [name, imageUri])

  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?"

  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover object-center" />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">{initial}</span>
      )}
    </span>
  )
}
