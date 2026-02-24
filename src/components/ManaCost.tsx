const SVG_BASE = "https://svgs.scryfall.io/card-symbols"

interface ManaCostProps {
  cost: string
  size?: "xs" | "sm"
}

export function ManaCost({ cost, size = "xs" }: ManaCostProps) {
  if (!cost) return null
  const pips = cost.match(/\{[^}]+\}/g) ?? []
  const dim = size === "xs" ? "w-4 h-4" : "w-5 h-5"

  return (
    <span className="flex items-center gap-0.5 flex-wrap">
      {pips.map((pip, i) => {
        const sym = pip.slice(1, -1).replace(/\//g, "")
        return (
          <img
            key={i}
            src={`${SVG_BASE}/${sym}.svg`}
            alt={sym}
            className={`${dim} shrink-0`}
          />
        )
      })}
    </span>
  )
}
