import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { MtgColor } from "@/types"

const SVG_BASE = "https://svgs.scryfall.io/card-symbols"

const COLOR_LABEL: Record<MtgColor, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
}

interface ColorPipsProps {
  colors: MtgColor[]
  size?: "sm" | "md"
}

export function ColorPips({ colors, size = "sm" }: ColorPipsProps) {
  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5"

  if (colors.length === 0) {
    return <img src={`${SVG_BASE}/C.svg`} alt="Colorless" className={`${dim} shrink-0`} />
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-0.5">
        {colors.map((c) => (
          <Tooltip key={c}>
            <TooltipTrigger asChild>
              <img src={`${SVG_BASE}/${c}.svg`} alt={COLOR_LABEL[c]} className={`${dim} shrink-0`} />
            </TooltipTrigger>
            <TooltipContent>{COLOR_LABEL[c]}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
