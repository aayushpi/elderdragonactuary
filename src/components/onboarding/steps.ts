import { copy } from "@/copy"

/**
 * The guided walkthrough, in order. This file is the *behaviour* of each step —
 * which surface it moves to and what it spotlights; the words live in
 * `src/copy.ts` under `copy.tour.steps`, keyed by the same id.
 *
 * A step can move the app to the surface it talks about (`route`, `drawer`) and
 * spotlight a real element on it (`target`, matched against `data-tour`). A step
 * whose target isn't on screen — the stats page before any game is logged, say —
 * falls back to a centred card with the same copy, so the tour never dead-ends.
 */

export type TourStepId = keyof typeof copy.tour.steps

export interface TourStep {
  id: TourStepId
  title: string
  body: string
  bullets?: readonly string[]
  /** value of the `data-tour` attribute to spotlight */
  target?: string
  /** route to move to before the step is shown */
  route?: string
  /** open ("log") or close ("none") the track-a-game drawer before showing */
  drawer?: "log" | "none"
  /** a drawn stand-in for a surface that doesn't exist until a game is running */
  sketch?: "live-board"
}

type TourStepBehaviour = Omit<TourStep, "title" | "body" | "bullets">

const STEP_BEHAVIOUR: TourStepBehaviour[] = [
  { id: "welcome", drawer: "none" },
  { id: "stats_overview", route: "/stats", target: "stats-headline" },
  { id: "stats_range", target: "stats-range" },
  { id: "stats_commanders", target: "stats-commanders" },
  { id: "stats_elo", target: "stats-elo" },
  { id: "track_entry", target: "nav-track" },
  { id: "track_pod", route: "/", drawer: "log", target: "log-pod" },
  { id: "track_players", target: "log-players" },
  { id: "track_save", target: "log-save" },
  { id: "live_entry", drawer: "none", target: "nav-live" },
  { id: "live_setup", route: "/live", target: "live-setup" },
  { id: "live_board", sketch: "live-board" },
  { id: "done", route: "/" },
]

export const TOUR_STEPS: TourStep[] = STEP_BEHAVIOUR.map((step) => {
  const words = copy.tour.steps[step.id] as { title: string; body: string; bullets?: readonly string[] }
  return { ...step, title: words.title, body: words.body, bullets: words.bullets }
})
