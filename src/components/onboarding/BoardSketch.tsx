import { SEAT_COLORS } from "@/live/engine"

/* A miniature of the live board for the walkthrough step that describes it.
 * The board itself only exists once a game is running, so a new player would
 * otherwise be reading about seats, taps, and attack drags with nothing on
 * screen to attach them to. */
export function BoardSketch() {
  return (
    <div className="relative mt-3 h-44 overflow-hidden rounded-xl border border-border" aria-hidden>
      <div
        style={{ backgroundColor: SEAT_COLORS[2] }}
        className="absolute inset-x-0 top-0 flex h-1/2 rotate-180 flex-col items-center justify-center text-white"
      >
        <SeatLabel>Player 2</SeatLabel>
        <LifeRow life={33} />
      </div>

      <div
        style={{ backgroundColor: SEAT_COLORS[1] }}
        className="absolute inset-x-0 bottom-0 flex h-1/2 flex-col items-center justify-center text-white"
      >
        <SeatLabel>You</SeatLabel>
        <div className="relative">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-black leading-none shadow-lg">
            −5
          </span>
          <LifeRow life={35} />
        </div>
        <span className="absolute left-3 top-2 rounded-full bg-black/70 px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider">
          Attack
        </span>
      </div>

      {/* the attack drag: from the bottom seat's grip up into the opponent */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 176" preserveAspectRatio="none">
        <path
          d="M56 100 C 92 88, 122 70, 150 46"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="absolute left-[76%] top-[25%] grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[11px] shadow-lg">
        ⚔
      </span>
    </div>
  )
}

function SeatLabel({ children }: { children: string }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/85">{children}</span>
  )
}

function LifeRow({ life }: { life: number }) {
  return (
    <div className="mt-0.5 flex items-center gap-2.5">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-black/25 text-sm font-bold leading-none">−</span>
      <span className="text-2xl font-black leading-none tabular-nums">{life}</span>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-black/25 text-sm font-bold leading-none">+</span>
    </div>
  )
}
