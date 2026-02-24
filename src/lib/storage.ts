import type { Game, Player } from "@/types"

const STORAGE_KEY = "commando_games"

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function loadGames(): Game[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Game[]) : []
  } catch {
    return []
  }
}

export function saveGames(games: Game[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}

// ── Export ────────────────────────────────────────────────────────────────────

interface ExportPlayer {
  commanderName: string
  commanderManaCost?: string
  commanderTypeLine?: string
  commanderColorIdentity?: string[]
  commanderImageUri?: string
  partnerName?: string
  partnerManaCost?: string
  partnerTypeLine?: string
  partnerImageUri?: string
  seatPosition: number
  fastMana: { hasFastMana: boolean; cards: string[] }
}

interface ExportGame {
  playedAt: string        // YYYY-MM-DD
  winTurn: number
  winnerIndex: number     // index into players array (0 = you)
  notes?: string
  players: ExportPlayer[]
}

interface ExportFile {
  exportedAt: string
  games: ExportGame[]
}

export function exportData(): string {
  const games = loadGames()

  const exportGames: ExportGame[] = games.map((g) => {
    const winnerIndex = g.players.findIndex((p) => p.id === g.winnerId)
    return {
      playedAt: g.playedAt.slice(0, 10),
      winTurn: g.winTurn,
      winnerIndex: winnerIndex >= 0 ? winnerIndex : 0,
      notes: g.notes,
      players: g.players.map(({ id: _id, isMe: _isMe, ...rest }) => rest as ExportPlayer),
    }
  })

  const file: ExportFile = {
    exportedAt: new Date().toISOString().slice(0, 10),
    games: exportGames,
  }

  return JSON.stringify(file, null, 2)
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function exportCSV(): string {
  const file = JSON.parse(exportData()) as { exportedAt: string; games: ExportGame[] }

  const headers = [
    "playedAt",
    "winTurn",
    "winnerIndex",
    "notes",
    "playerIndex",
    "seatPosition",
    "commanderName",
    "commanderManaCost",
    "commanderTypeLine",
    "commanderColorIdentity",
    "commanderImageUri",
    "partnerName",
    "partnerManaCost",
    "partnerTypeLine",
    "partnerImageUri",
    "fastManaHasFastMana",
    "fastManaCards",
  ]

  const rows: string[] = []
  rows.push(headers.join(','))

  file.games.forEach((g) => {
    g.players.forEach((p, playerIndex) => {
      const row = [
        g.playedAt,
        String(g.winTurn ?? ""),
        String(g.winnerIndex ?? ""),
        g.notes ?? "",
        String(playerIndex),
        String(p.seatPosition ?? ""),
        p.commanderName ?? "",
        p.commanderManaCost ?? "",
        p.commanderTypeLine ?? "",
        Array.isArray(p.commanderColorIdentity) ? p.commanderColorIdentity.join('|') : "",
        p.commanderImageUri ?? "",
        p.partnerName ?? "",
        p.partnerManaCost ?? "",
        p.partnerTypeLine ?? "",
        p.partnerImageUri ?? "",
        String(Boolean(p.fastMana?.hasFastMana)),
        Array.isArray(p.fastMana?.cards) ? p.fastMana!.cards.join('|') : "",
      ]

      rows.push(row.map(csvEscape).join(','))
    })
  })

  return rows.join('\n')
}

// ── Import ────────────────────────────────────────────────────────────────────

export function importData(json: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(json)

    // Accept the clean export format { exportedAt, games: ExportGame[] }
    // or a raw Game[] array (backwards compat with old exports)
    let rawGames: unknown[]
    if (Array.isArray(parsed)) {
      rawGames = parsed
    } else if (parsed.games && Array.isArray(parsed.games)) {
      rawGames = parsed.games
    } else {
      return { success: false, count: 0, error: "Invalid format — expected a games array." }
    }

    const games: Game[] = rawGames.map((raw: unknown) => {
      const g = raw as Record<string, unknown>

      // Detect clean format (winnerIndex present) vs legacy format (winnerId present)
      if (typeof g.winnerIndex === "number" && Array.isArray(g.players)) {
        const playerData = g.players as ExportPlayer[]
        const players: Player[] = playerData.map((p, i) => ({
          ...p,
          id: generateId(),
          isMe: i === 0,
          seatPosition: p.seatPosition as Player["seatPosition"],
          commanderColorIdentity: p.commanderColorIdentity as Player["commanderColorIdentity"],
        }))
        return {
          id: generateId(),
          playedAt: typeof g.playedAt === "string" ? new Date(g.playedAt).toISOString() : new Date().toISOString(),
          winTurn: typeof g.winTurn === "number" ? g.winTurn : 0,
          winnerId: players[g.winnerIndex]?.id ?? players[0].id,
          notes: typeof g.notes === "string" ? g.notes : undefined,
          players,
        } as Game
      }

      // Legacy format: already a full Game object — regenerate IDs to ensure fresh start
      const legacyPlayers = (g.players as Player[]).map((p, i) => ({
        ...p,
        id: generateId(),
        isMe: i === 0,
      }))
      const oldToNew = new Map<string, string>()
      ;(g.players as Player[]).forEach((p, i) => oldToNew.set(p.id, legacyPlayers[i].id))
      const oldWinnerId = g.winnerId as string
      return {
        ...g,
        id: generateId(),
        players: legacyPlayers,
        winnerId: oldToNew.get(oldWinnerId) ?? legacyPlayers[0].id,
      } as Game
    })

    saveGames(games)
    return { success: true, count: games.length }
  } catch {
    return { success: false, count: 0, error: "Invalid JSON." }
  }
}
