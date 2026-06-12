/* Featurebase in-app widgets (feedback, changelog, help center, roadmap).
 *
 * Org subdomain comes from VITE_FEATUREBASE_ORG; when it's absent every helper
 * here is a no-op and the UI hides its entry points — same "works unconfigured"
 * contract as Supabase. Nothing in this file ever throws. */

const ORG = (import.meta.env.VITE_FEATUREBASE_ORG as string | undefined)?.trim() || ""

type FeaturebaseFn = ((...args: unknown[]) => void) & { q?: unknown[][] }

interface FeaturebaseWindow extends Window {
  Featurebase?: FeaturebaseFn
}

/** The Featurebase command queue. The real SDK drains `.q` once it loads, so
 *  calls made before then are buffered rather than lost. */
function fb(): FeaturebaseFn | null {
  if (!ORG || typeof window === "undefined") return null
  const w = window as FeaturebaseWindow
  if (typeof w.Featurebase !== "function") {
    const stub = function (...args: unknown[]) {
      ;(stub.q = stub.q || []).push(args)
    } as FeaturebaseFn
    w.Featurebase = stub
  }
  return w.Featurebase ?? null
}

function postToWidget(data: Record<string, unknown>): void {
  if (typeof window === "undefined") return
  window.postMessage({ target: "FeaturebaseWidget", data }, "*")
}

export function isFeaturebaseEnabled(): boolean {
  return Boolean(ORG)
}

let sdkInjected = false

/** Inject the SDK script once. Safe to call repeatedly. */
export function loadFeaturebaseSdk(): void {
  if (!ORG || typeof document === "undefined" || sdkInjected) return
  if (document.getElementById("featurebase-sdk")) {
    sdkInjected = true
    return
  }
  const script = document.createElement("script")
  script.id = "featurebase-sdk"
  script.src = "https://do.featurebase.app/js/sdk.js"
  document.head.appendChild(script)
  sdkInjected = true
}

/** (Re)initialize the feedback + changelog widgets. Re-calling with a new theme
 *  or email updates them, so it's safe to run on every theme/auth change. */
export function initFeaturebaseWidgets(opts: { theme: "light" | "dark"; email?: string }): void {
  const f = fb()
  if (!f) return
  f("initialize_feedback_widget", {
    organization: ORG,
    theme: opts.theme,
    email: opts.email || undefined,
    placement: "right",
    locale: "en",
  })
  f("init_changelog_widget", {
    organization: ORG,
    theme: opts.theme,
    placement: "right",
    fullscreenPopup: true,
  })
}

export function openFeaturebaseFeedback(): void {
  postToWidget({ action: "openFeedbackWidget" })
}

export function openFeaturebaseChangelog(): void {
  fb()?.("manually_open_changelog_popup")
}

/** Open the messenger and navigate it to a specific view. */
function openWidgetView(view: "MainView" | "RoadmapView"): void {
  postToWidget({ action: "openFeedbackWidget" })
  // The view must be set after the widget mounts, hence the deferral.
  window.setTimeout(() => postToWidget({ action: "changePage", payload: view }), 60)
}

export function openFeaturebaseHelp(): void {
  openWidgetView("MainView")
}

export function openFeaturebaseRoadmap(): void {
  openWidgetView("RoadmapView")
}
