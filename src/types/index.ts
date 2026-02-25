// ─── Scryfall API shapes ────────────────────────────────────────────────────

export interface ScryfallCardImageUris {
  small: string
  normal: string
  large: string
  art_crop: string
  border_crop: string
}

export interface ScryfallCard {
  id: string
  name: string
  mana_cost: string
  color_identity: string[]
  type_line: string
  image_uris?: ScryfallCardImageUris
  card_faces?: Array<{ mana_cost?: string; image_uris?: ScryfallCardImageUris }>
}

// ─── Domain models ──────────────────────────────────────────────────────────

export type SeatPosition = 1 | 2 | 3 | 4 | 5 | 6

export type MtgColor = "W" | "U" | "B" | "R" | "G"

export interface RecentCommander {
  name: string
  manaCost?: string
  imageUri?: string
  typeLine?: string
  colorIdentity?: MtgColor[]
}

export interface FastManaInfo {
  hasFastMana: boolean
  cards: string[]
}

export interface Player {
  id: string
  isMe: boolean
  commanderName: string
  commanderImageUri?: string
  commanderColorIdentity?: MtgColor[]
  commanderManaCost?: string
  commanderTypeLine?: string
  partnerName?: string
  partnerImageUri?: string
  partnerManaCost?: string
  partnerTypeLine?: string
  knockoutTurn?: number
  seatPosition: SeatPosition
  fastMana: FastManaInfo
}

export interface Game {
  id: string
  playedAt: string
  players: Player[]
  winnerId: string
  winTurn: number
  notes?: string
  winConditions?: string[]
  keyWinconCards?: string[]
  bracket?: number // 1-5, optional power level bracket
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface WinRateStat {
  wins: number
  games: number
  rate: number
}

export interface SeatStats {
  seat1: WinRateStat
  seat2: WinRateStat
  seat3: WinRateStat
  seat4: WinRateStat
  seat5: WinRateStat
  seat6: WinRateStat
}

export interface CommanderStat {
  name: string
  manaCost?: string
  imageUri?: string
  wins: number
  games: number
  rate: number
  averageWinTurn: number | null
  withFastMana: WinRateStat
  againstFastMana: WinRateStat
  recentResults: Array<{
    result: "W" | "L"
    date: string
    winTurn: number
    winningCommander: string
  }>
  keyCards: Array<{
    name: string
    count: number
  }>
}

export interface CommanderColorIdentityStat {
  key: string
  colors: MtgColor[]
  uniqueCommanders: number
  wins: number
  games: number
  winRate: number
  lossRate: number
}

export interface ComputedStats {
  overall: WinRateStat
  withFastMana: WinRateStat
  againstFastMana: WinRateStat
  bySeat: SeatStats
  byCommander: CommanderStat[]
  byCommanderColorIdentity: CommanderColorIdentityStat[]
  mostPlayedCommanderColorIdentity: CommanderColorIdentityStat | null
  mostSuccessfulCommanderColorIdentity: CommanderColorIdentityStat | null
  archnemesisCommanderColorIdentity: CommanderColorIdentityStat | null
  averageWinTurn: number | null
  gamesPlayed: number
  topWinConditions: Array<{ condition: string; count: number }>
}

// ─── Routing ────────────────────────────────────────────────────────────────

export type AppView = "dashboard" | "log-game" | "edit-game" | "history" | "settings" | "game-detail"

export interface AppState {
  view: AppView
  selectedGameId?: string
}
