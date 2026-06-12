// Modern UI accent system. A single configurable accent drives --primary,
// --primary-foreground, and --ring. Each entry is [light, dark], and each of
// those is [color, foreground] as raw HSL triplets (no hsl() wrapper).

export type AccentName = "Lime" | "Blue" | "Orange" | "Violet"

type AccentPair = [string, string]

interface AccentDef {
  light: AccentPair
  dark: AccentPair
}

export const ACCENTS: Record<AccentName, AccentDef> = {
  Lime: { light: ["84 81% 42%", "85 90% 6%"], dark: ["82 78% 55%", "85 90% 7%"] },
  Blue: { light: ["221 83% 53%", "0 0% 100%"], dark: ["217 91% 64%", "222 60% 8%"] },
  Orange: { light: ["24 95% 50%", "0 0% 100%"], dark: ["27 96% 61%", "24 70% 8%"] },
  Violet: { light: ["262 83% 58%", "0 0% 100%"], dark: ["258 90% 70%", "260 60% 9%"] },
}

// Solid swatch colors for the Settings accent picker.
export const ACCENT_SWATCH: Record<AccentName, string> = {
  Lime: "#a3e635",
  Blue: "#3b82f6",
  Orange: "#fb923c",
  Violet: "#8b5cf6",
}

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[]

const STORAGE_KEY = "accent"
const DEFAULT_ACCENT: AccentName = "Orange"

export function loadAccent(): AccentName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && stored in ACCENTS ? (stored as AccentName) : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

export function saveAccent(accent: AccentName) {
  try {
    localStorage.setItem(STORAGE_KEY, accent)
  } catch {
    void 0
  }
}

/** Apply an accent to the document by overriding the primary/ring tokens. */
export function applyAccent(accent: AccentName, dark: boolean) {
  const def = ACCENTS[accent] ?? ACCENTS[DEFAULT_ACCENT]
  const [color, foreground] = dark ? def.dark : def.light
  const el = document.documentElement
  el.style.setProperty("--primary", color)
  el.style.setProperty("--primary-foreground", foreground)
  el.style.setProperty("--ring", color)
}
