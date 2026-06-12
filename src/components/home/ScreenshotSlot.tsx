import { useState } from "react"
import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Replaceable product-screenshot slot for the marketing homepage.
 *
 * Pass `src` pointing at a file under `public/marketing/`. Until that file
 * exists (or if it fails to load) the slot shows a labelled placeholder, so
 * the page looks intentional before real screenshots are dropped in. Drop a
 * matching PNG into `public/marketing/` and it appears automatically.
 */
interface ScreenshotSlotProps {
  src?: string
  placeholder: string
  className?: string
  radius?: number
}

export function ScreenshotSlot({ src, placeholder, className, radius = 12 }: ScreenshotSlotProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={{ borderRadius: radius }}
    >
      {showImage ? (
        <img
          src={src}
          alt={placeholder}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center gap-2 p-4 text-center art-ph">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6 opacity-50" />
            <span className="max-w-[28ch] text-xs font-medium">{placeholder}</span>
          </div>
        </div>
      )}
    </div>
  )
}
