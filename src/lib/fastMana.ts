/** The fast-mana staples players reach for most often. Shown as one-tap chips
 *  above the search box so logging the common case needs no typing. Names match
 *  Scryfall exactly so they round-trip through the card search. */
export const POPULAR_FAST_MANA = [
  "Sol Ring",
  "Mana Crypt",
  "Arcane Signet",
  "Mana Vault",
  "Jeweled Lotus",
  "Chrome Mox",
  "Mox Diamond",
  "Mox Opal",
  "Lotus Petal",
  "Dockside Extortionist",
  "Ancient Tomb",
  "Fellwar Stone",
] as const

/** Broader set of fast-mana staples used to classify an imported decklist.
 *  When a deck contains one of these, it's surfaced as a fast-mana default in
 *  the picker. Superset of POPULAR_FAST_MANA — cheap rocks, rituals, and lands
 *  that produce mana ahead of curve. Names match Scryfall exactly. */
export const FAST_MANA_STAPLES: readonly string[] = [
  ...POPULAR_FAST_MANA,
  // Moxen & zero-cost accelerants
  "Mox Amber",
  "Mox Tantalite",
  "Mana Crypt",
  "Lion's Eye Diamond",
  "Mox Sapphire",
  "Mox Ruby",
  "Mox Jet",
  "Mox Pearl",
  "Mox Emerald",
  "Jeweled Amulet",
  // Signets (two-mana rocks that fix and ramp)
  "Dimir Signet",
  "Izzet Signet",
  "Azorius Signet",
  "Orzhov Signet",
  "Rakdos Signet",
  "Golgari Signet",
  "Gruul Signet",
  "Selesnya Signet",
  "Boros Signet",
  "Simic Signet",
  // One-mana rocks / rituals
  "Everflowing Chalice",
  "Dark Ritual",
  "Cabal Ritual",
  "Rite of Flame",
  "Pyretic Ritual",
  "Desperate Ritual",
  "Seething Song",
  "Jeska's Will",
  "Simian Spirit Guide",
  "Elvish Spirit Guide",
  "Culling the Weak",
  "Songs of the Damned",
  "Wild Cantor",
  // Two-mana rocks
  "Talisman of Dominance",
  "Talisman of Creativity",
  "Talisman of Progress",
  "Talisman of Hierarchy",
  "Talisman of Indulgence",
  "Talisman of Impulse",
  "Talisman of Resilience",
  "Talisman of Conviction",
  "Talisman of Curiosity",
  "Talisman of Unity",
  "Coalition Relic",
  "Mind Stone",
  "Prismatic Lens",
  "Star Compass",
  "Coldsteel Heart",
  "Fractured Powerstone",
  // Fast lands / mana-positive lands
  "City of Traitors",
  "Crystal Vein",
  "Lotus Field",
  "Lotus Vale",
  "Gaea's Cradle",
  "Serra's Sanctum",
  "Cabal Coffers",
  "Nykthos, Shrine to Nyx",
  // Mana dorks that accelerate hard
  "Birds of Paradise",
  "Llanowar Elves",
  "Elvish Mystic",
  "Fyndhorn Elves",
  "Deathrite Shaman",
  "Priest of Titania",
  "Elves of Deep Shadow",
  "Ignoble Hierarch",
  "Noble Hierarch",
  "Avacyn's Pilgrim",
  "Boreal Druid",
  "Delighted Halfling",
  "Ragavan, Nimble Pilferer",
  "Esper Sentinel",
  "Ancient Tomb",
]

const FAST_MANA_LOWER = new Set(FAST_MANA_STAPLES.map((c) => c.toLowerCase()))

/** Whether a card name is a known fast-mana staple (case-insensitive). */
export function isFastMana(name: string): boolean {
  return FAST_MANA_LOWER.has(name.trim().toLowerCase())
}
