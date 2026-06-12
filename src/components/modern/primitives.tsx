import type { MtgColor } from "@/types"

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

/* ====== Color-identity pips — flat, hairline, no candy ====== */
const PIP_TONES: Record<MtgColor, string> = {
  W: "bg-amber-200/70 dark:bg-amber-200/20 text-amber-900 dark:text-amber-200",
  U: "bg-sky-200/70 dark:bg-sky-300/20 text-sky-900 dark:text-sky-200",
  B: "bg-zinc-300/80 dark:bg-zinc-400/20 text-zinc-800 dark:text-zinc-300",
  R: "bg-rose-200/70 dark:bg-rose-300/20 text-rose-900 dark:text-rose-200",
  G: "bg-emerald-200/70 dark:bg-emerald-300/20 text-emerald-900 dark:text-emerald-200",
}

export function Pip({ color }: { color: MtgColor }) {
  return (
    <span
      className={
        "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-semibold font-mono " +
        PIP_TONES[color]
      }
    >
      {color}
    </span>
  )
}

export function Pips({ colors }: { colors: MtgColor[] }) {
  if (colors.length === 0) {
    return (
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-semibold font-mono bg-zinc-200/70 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-300">
        C
      </span>
    )
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
      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground font-mono text-[11px] font-semibold tracking-tight">
        ed
      </span>
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
