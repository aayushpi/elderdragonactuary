/**
 * The guided walkthrough, in order. Each step can move the app to the surface
 * it talks about (`route`, `drawer`) and spotlight a real element on it
 * (`target`, matched against `data-tour`). A step whose target isn't on screen
 * — the stats page before any game is logged, say — falls back to a centred
 * card with the same copy, so the tour never dead-ends.
 */

export interface TourStep {
  id: string
  title: string
  body: string
  bullets?: string[]
  /** value of the `data-tour` attribute to spotlight */
  target?: string
  /** route to move to before the step is shown */
  route?: string
  /** open ("log") or close ("none") the track-a-game drawer before showing */
  drawer?: "log" | "none"
  /** a drawn stand-in for a surface that doesn't exist until a game is running */
  sketch?: "live-board"
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Elder Dragon Actuary",
    body: "A one-minute tour of the three screens you'll use most: your stats, tracking a finished game, and running a game at the table.",
    drawer: "none",
  },
  {
    id: "stats_overview",
    title: "Your numbers, up top",
    body: "Win rate, average winning turn, and how you do with — and against — fast mana. Everything here is computed from the games you log.",
    route: "/stats",
    target: "stats-headline",
  },
  {
    id: "stats_range",
    title: "Change the window",
    body: "All time, this year, or the last 90 days. Every stat below re-reads for the range you pick.",
    target: "stats-range",
  },
  {
    id: "stats_commanders",
    title: "Deck by deck",
    body: "Every commander you've sleeved up, sortable by win rate, winning turn, or total wins — so you can see which deck is actually carrying you.",
    target: "stats-commanders",
  },
  {
    id: "stats_elo",
    title: "ELO ratings",
    body: "Your pods and commanders each carry a rating that moves after every game, so beating a stacked table counts for more than beating a jank one.",
    target: "stats-elo",
  },
  {
    id: "track_entry",
    title: "Track a finished game",
    body: "Tap here to log a game you've already played. It opens in a panel you can minimise and come back to.",
    target: "nav-track",
  },
  {
    id: "track_pod",
    title: "Start with the table",
    body: "Pick how many players, or reuse a pod you've logged before to fill every seat in one tap.",
    route: "/",
    drawer: "log",
    target: "log-pod",
  },
  {
    id: "track_players",
    title: "Seats, commanders, winner",
    body: "Give each player a commander and a seat, then mark whoever won. Everything else — brackets, wincon cards, notes — is optional.",
    target: "log-players",
  },
  {
    id: "track_save",
    title: "Save it",
    body: "Saving drops the game straight into your history, stats, and ELO.",
    target: "log-save",
  },
  {
    id: "live_entry",
    title: "Playing right now?",
    body: "Live game turns your phone into the table's life tracker, and logs the game for you when it ends.",
    drawer: "none",
    target: "nav-live",
  },
  {
    id: "live_setup",
    title: "Pick the table",
    body: "Tap a recent pod to jump straight in, or build the roster by hand. Commanders can wait — you can set them on the board.",
    route: "/live",
    target: "live-setup",
  },
  {
    id: "live_board",
    title: "On the board",
    body: "Each player gets a seat, rotated so it reads right way up from where they're sitting.",
    sketch: "live-board",
    bullets: [
      "Tap − or + to change life — a running total shows what you've tapped so far.",
      "Hold either button for ±10.",
      "Drag Attack from your seat onto another to deal damage, with commander, poison, and lifelink toggles.",
      "Drop on the centre target to hit every opponent at once.",
    ],
  },
  {
    id: "done",
    title: "That's the tour",
    body: "Save the live game when one player is left and it lands in your history with the winning turn already filled in. You can replay this walkthrough any time from Settings → Getting started.",
    route: "/",
  },
]
