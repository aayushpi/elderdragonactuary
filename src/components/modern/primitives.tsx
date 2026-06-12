import type { MtgColor } from "@/types"
import { LogoMark } from "@/components/modern/LogoMark"

/* ====== Shared class strings (Modern UI design language) ====== */
export const CARD = "rounded-lg bg-card border border-border"
export const SECTION_LABEL =
  "text-[11px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground"

/* Full-screen sheet on phones, top-anchored modal on tablet+. Shared by the
 * one-tap pickers so they all feel identical. */
export const SHEET_CONTENT_CLASS =
  "flex flex-col gap-0 p-0 overflow-hidden " +
  "!left-0 !top-0 !translate-x-0 !translate-y-0 w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 " +
  "sm:!left-[50%] sm:!top-3 sm:!translate-x-[-50%] sm:w-full sm:max-w-md sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-lg sm:border"

/* ====== Color-identity pips — official Scryfall mana symbols ====== */
const SYMBOL_BASE = "https://svgs.scryfall.io/card-symbols"

export function Pip({ color }: { color: MtgColor }) {
  return (
    <img src={`${SYMBOL_BASE}/${color}.svg`} alt={color} className="h-[18px] w-[18px] shrink-0" />
  )
}

export function Pips({ colors }: { colors: MtgColor[] }) {
  if (colors.length === 0) {
    return <img src={`${SYMBOL_BASE}/C.svg`} alt="C" className="h-[18px] w-[18px] shrink-0" />
  }
  return (
    <span className="inline-flex items-center gap-1">
      {colors.map((c, i) => (
        <Pip key={`${c}-${i}`} color={c} />
      ))}
    </span>
  )
}

/* ====== Result badge — Won / Lost ====== */
export function ResultBadge({ won }: { won: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold " +
        (won ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")
      }
    >
      {won ? "Won" : "Lost"}
    </span>
  )
}

/* ====== Wordmark ====== */
export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 shrink-0 select-none">
      <LogoMark size={28} />
      {!compact && (
        <span className="font-semibold tracking-tight text-[15px]">Elder Dragon Actuary</span>
      )}
    </span>
  )
}

/* ====== Win-rate progress bar ====== */
export function WrBar({ rate }: { rate: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.round(rate * 100)}%` }}
      />
    </div>
  )
}
