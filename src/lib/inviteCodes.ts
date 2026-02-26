function normalizeInviteCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase()
}

const DEFAULT_MAGIC_MEME_CODES = [
  "BOLT THE BIRD",
  "DIES TO DOOM BLADE",
  "MANA CRYPT FLIP",
  "DRAW GO",
  "SCOOP AT SORCERY SPEED",
]

function configuredCodes(): string[] {
  const raw = import.meta.env.VITE_INVITE_CODES as string | undefined
  if (!raw?.trim()) return DEFAULT_MAGIC_MEME_CODES

  const parsed = raw
    .split(",")
    .map((code) => normalizeInviteCode(code))
    .filter(Boolean)

  return parsed.length > 0 ? parsed : DEFAULT_MAGIC_MEME_CODES
}

export function validateInviteCode(code: string): boolean {
  const normalized = normalizeInviteCode(code)
  if (!normalized) return false
  return configuredCodes().includes(normalized)
}
