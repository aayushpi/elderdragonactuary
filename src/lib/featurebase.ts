/* Featurebase links — feedback board, changelog, roadmap, help center.
 *
 * We link out to the hosted Featurebase portal (<org>.featurebase.app) rather
 * than embedding the in-app widget SDK: the SDK widgets are a paid feature, but
 * the hosted portal works on every plan. Org subdomain comes from
 * VITE_FEATUREBASE_ORG; when it's absent the UI hides its entry points. */

const ORG = (import.meta.env.VITE_FEATUREBASE_ORG as string | undefined)?.trim() || ""

export type FeaturebaseSection = "feedback" | "changelog" | "roadmap" | "help"

const PATHS: Record<FeaturebaseSection, string> = {
  feedback: "/",
  changelog: "/changelog",
  roadmap: "/roadmap",
  help: "/help",
}

export function isFeaturebaseEnabled(): boolean {
  return Boolean(ORG)
}

/** Absolute URL to a section of the hosted Featurebase portal. */
export function featurebaseUrl(section: FeaturebaseSection): string {
  return `https://${ORG}.featurebase.app${PATHS[section]}`
}
