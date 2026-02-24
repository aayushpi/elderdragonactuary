import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { MtgColor } from "@/types"

const COLOR_CONFIG: Record<MtgColor, { bg: string; label: string; symbol: string }> = {
  W: { bg: "bg-yellow-100 border-yellow-300 text-yellow-800", label: "White", symbol: "W" },
  U: { bg: "bg-blue-500 border-blue-600 text-white", label: "Blue", symbol: "U" },
  B: { bg: "bg-gray-800 border-gray-600 text-white", label: "Black", symbol: "B" },
  R: { bg: "bg-red-500 border-red-600 text-white", label: "Red", symbol: "R" },
  G: { bg: "bg-green-600 border-green-700 text-white", symbol: "G", label: "Green" },
}

interface ColorPipsProps {
  colors: MtgColor[]
  size?: "sm" | "md"
}

export function ColorPips({ colors, size = "sm" }: ColorPipsProps) {
  if (colors.length === 0) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full border ${size === "sm" ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]"} bg-gray-200 border-gray-300 text-gray-500 font-bold`}>
        C
      </span>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-0.5">
        {colors.map((c) => {
          const cfg = COLOR_CONFIG[c]
          return (
            <Tooltip key={c}>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex items-center justify-center rounded-full border font-bold ${cfg.bg} ${size === "sm" ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]"}`}
                >
                  {cfg.symbol}
                </span>
              </TooltipTrigger>
              <TooltipContent>{cfg.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
