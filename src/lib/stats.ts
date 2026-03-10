import type { Game, WinRateStat, SeatStats, ComputedStats, SeatPosition, MtgColor, PodEloGroup, PodPlayerElo, PodEloSnapshot, CommanderEloEntry } from "@/types"

function winRate(wins: number, games: number): WinRateStat {
  return { wins, games, rate: games === 0 ? 0 : wins / games }
}

function getMe(game: Game) {
  return game.players.find((p) => p.isMe)
}

const COLOR_ORDER: MtgColor[] = ["W", "U", "B", "R", "G"]

function normalizeColorIdentity(colors?: MtgColor[]): MtgColor[] {
  if (!colors || colors.length === 0) return []
  return [...new Set(colors)].sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b))
}

function colorIdentityKey(colors: MtgColor[]): string {
  return colors.length === 0 ? "C" : colors.join("")
}

export function computeStats(games: Game[]): ComputedStats {
  const myGames = games.filter((g) => g.players.some((p) => p.isMe))

  // Overall
  const overallWins = myGames.filter((g) => {
    const me = getMe(g)
    return me && g.winnerId === me.id
  }).length
  const overall = winRate(overallWins, myGames.length)

  // With fast mana (I had fast mana)
  const withFmGames = myGames.filter((g) => getMe(g)?.fastMana.hasFastMana)
  const withFmWins = withFmGames.filter((g) => {
    const me = getMe(g)
    return me && g.winnerId === me.id
  }).length
  const withFastMana = winRate(withFmWins, withFmGames.length)

  // Against fast mana (at least one opponent had fast mana)
  const vsGames = myGames.filter((g) =>
    g.players.some((p) => !p.isMe && p.fastMana.hasFastMana)
  )
  const vsWins = vsGames.filter((g) => {
    const me = getMe(g)
    return me && g.winnerId === me.id
  }).length
  const againstFastMana = winRate(vsWins, vsGames.length)

  // By seat (all 6 positions)
  const seats = [1, 2, 3, 4, 5, 6] as SeatPosition[]
  const bySeat = seats.reduce(
    (acc, seat) => {
      const seatGames = myGames.filter((g) => getMe(g)?.seatPosition === seat)
      const seatWins = seatGames.filter((g) => {
        const me = getMe(g)
        return me && g.winnerId === me.id
      }).length
      acc[`seat${seat}` as keyof SeatStats] = winRate(seatWins, seatGames.length)
      return acc
    },
    {} as SeatStats
  )

  // By bracket (1-5)
  const byBracket = [1, 2, 3, 4, 5].map((bracket) => {
    const bracketGames = myGames.filter((g) => g.bracket === bracket)
    const bracketWins = bracketGames.filter((g) => {
      const me = getMe(g)
      return me && g.winnerId === me.id
    }).length

    return {
      bracket,
      wins: bracketWins,
      games: bracketGames.length,
    }
  })

  // By commander (with per-commander breakdowns)
  const commanderMap = new Map<string, {
    wins: number
    games: number
    manaCost?: string
    imageUri?: string
    winTurnSum: number
    withFmWins: number
    withFmGames: number
    vsFmWins: number
    vsFmGames: number
  }>()

  for (const game of myGames) {
    const me = getMe(game)
    if (!me) continue
    const iWon = game.winnerId === me.id
    const name = me.commanderName
    const entry = commanderMap.get(name) ?? {
      wins: 0, games: 0,
      manaCost: me.commanderManaCost, imageUri: me.commanderImageUri,
      winTurnSum: 0,
      withFmWins: 0, withFmGames: 0,
      vsFmWins: 0, vsFmGames: 0,
    }
    entry.games++
    if (iWon) { entry.wins++; entry.winTurnSum += game.winTurn }
    if (me.fastMana.hasFastMana) { entry.withFmGames++; if (iWon) entry.withFmWins++ }
    if (game.players.some((p) => !p.isMe && p.fastMana.hasFastMana)) { entry.vsFmGames++; if (iWon) entry.vsFmWins++ }
    commanderMap.set(name, entry)
  }

  const byCommander = Array.from(commanderMap.entries())
    .map(([name, e]) => ({
      commanderGames: myGames
        .filter((g) => getMe(g)?.commanderName === name)
        .slice()
        .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()),
      name,
      manaCost: e.manaCost,
      imageUri: e.imageUri,
      wins: e.wins,
      games: e.games,
      rate: e.games === 0 ? 0 : e.wins / e.games,
      averageWinTurn: e.wins === 0 ? null : e.winTurnSum / e.wins,
      withFastMana: winRate(e.withFmWins, e.withFmGames),
      againstFastMana: winRate(e.vsFmWins, e.vsFmGames),
    }))
    .map((entry) => {
      const recentResults = entry.commanderGames
        .slice(0, 10)
        .map((game) => {
          const me = getMe(game)
          const winner = game.players.find((p) => p.id === game.winnerId)
          return {
            result: me && game.winnerId === me.id ? "W" as const : "L" as const,
            date: game.playedAt,
            winTurn: game.winTurn,
            winningCommander: winner?.commanderName ?? "Unknown Commander",
          }
        })

      const keyCardCounts = new Map<string, number>()
      for (const game of entry.commanderGames) {
        for (const card of game.keyWinconCards ?? []) {
          keyCardCounts.set(card, (keyCardCounts.get(card) ?? 0) + 1)
        }
      }

      const keyCards = Array.from(keyCardCounts.entries())
        .map(([cardName, count]) => ({ name: cardName, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 5)

      const { commanderGames: _, ...rest } = entry
      void _
      return {
        ...rest,
        recentResults,
        keyCards,
      }
    })
    .sort((a, b) => b.rate - a.rate || b.games - a.games)

  const colorIdentityMap = new Map<string, {
    colors: MtgColor[]
    commanders: Set<string>
    wins: number
    games: number
  }>()

  for (const game of myGames) {
    const me = getMe(game)
    if (!me) continue

    const colors = normalizeColorIdentity(me.commanderColorIdentity)
    const key = colorIdentityKey(colors)
    const entry = colorIdentityMap.get(key) ?? {
      colors,
      commanders: new Set<string>(),
      wins: 0,
      games: 0,
    }

    entry.commanders.add(me.commanderName)
    entry.games++
    if (game.winnerId === me.id) {
      entry.wins++
    }

    colorIdentityMap.set(key, entry)
  }

  const byCommanderColorIdentity = Array.from(colorIdentityMap.entries())
    .map(([key, entry]) => {
      const winRate = entry.games === 0 ? 0 : entry.wins / entry.games
      return {
        key,
        colors: entry.colors,
        uniqueCommanders: entry.commanders.size,
        wins: entry.wins,
        games: entry.games,
        winRate,
        lossRate: 1 - winRate,
      }
    })
    .sort((a, b) => b.games - a.games || b.uniqueCommanders - a.uniqueCommanders || a.key.localeCompare(b.key))

  const mostPlayedCommanderColorIdentity =
    byCommanderColorIdentity[0] ?? null

  const mostSuccessfulCommanderColorIdentity =
    byCommanderColorIdentity.length === 0
      ? null
      : [...byCommanderColorIdentity].sort(
          (a, b) => b.winRate - a.winRate || b.games - a.games || b.uniqueCommanders - a.uniqueCommanders
        )[0]

  const archnemesisCommanderColorIdentity =
    byCommanderColorIdentity.length === 0
      ? null
      : [...byCommanderColorIdentity].sort(
          (a, b) => b.lossRate - a.lossRate || b.games - a.games || b.uniqueCommanders - a.uniqueCommanders
        )[0]

  // Average win turn (overall)
  const myWins = myGames.filter((g) => {
    const me = getMe(g)
    return me && g.winnerId === me.id
  })
  const averageWinTurn =
    myWins.length === 0
      ? null
      : myWins.reduce((sum, g) => sum + g.winTurn, 0) / myWins.length

  // Top win conditions
  const winConditionCounts = new Map<string, number>()
  for (const game of myWins) {
    if (game.winConditions && game.winConditions.length > 0) {
      for (const condition of game.winConditions) {
        winConditionCounts.set(condition, (winConditionCounts.get(condition) ?? 0) + 1)
      }
    }
  }
  const topWinConditions = Array.from(winConditionCounts.entries())
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count || a.condition.localeCompare(b.condition))
    .slice(0, 5)

  return {
    overall,
    withFastMana,
    againstFastMana,
    bySeat,
    byBracket,
    byCommander,
    byCommanderColorIdentity,
    mostPlayedCommanderColorIdentity,
    mostSuccessfulCommanderColorIdentity,
    archnemesisCommanderColorIdentity,
    averageWinTurn,
    gamesPlayed: myGames.length,
    topWinConditions,
  }
}

// ─── Pod ELO ────────────────────────────────────────────────────────────────

const DEFAULT_ELO = 1500
const K_FACTOR = 32

/**
 * Compute multiplayer ELO for a single game.
 *
 * In a multiplayer free-for-all, each player is compared pairwise against every
 * other player.  The winner scores 1 against every opponent; each loser scores 0
 * against the winner and 0.5 against other losers ("drew" with fellow non-winners).
 *
 * The rating adjustment is the average of all pairwise adjustments.
 */
function multiplayerEloUpdate(
  ratings: Map<string, number>,
  playerNames: string[],
  winnerName: string,
): Map<string, number> {
  const n = playerNames.length
  if (n < 2) return new Map(ratings)

  const deltas = new Map<string, number>()
  for (const name of playerNames) deltas.set(name, 0)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = playerNames[i]
      const b = playerNames[j]
      const ra = ratings.get(a) ?? DEFAULT_ELO
      const rb = ratings.get(b) ?? DEFAULT_ELO

      const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400))
      const eb = 1 - ea

      let sa: number, sb: number
      if (a === winnerName) {
        sa = 1; sb = 0
      } else if (b === winnerName) {
        sa = 0; sb = 1
      } else {
        // both lost — treat as draw
        sa = 0.5; sb = 0.5
      }

      deltas.set(a, (deltas.get(a) ?? 0) + K_FACTOR * (sa - ea))
      deltas.set(b, (deltas.get(b) ?? 0) + K_FACTOR * (sb - eb))
    }
  }

  // Average over (n-1) pairwise comparisons per player
  const next = new Map<string, number>()
  for (const name of playerNames) {
    const old = ratings.get(name) ?? DEFAULT_ELO
    next.set(name, Math.round(old + (deltas.get(name) ?? 0) / (n - 1)))
  }
  return next
}

/** Pod key: sorted set of display names joined by ||| */
function podKeyForGame(game: Game): string | null {
  const names = game.players.map((p) => p.displayName?.trim()).filter(Boolean) as string[]
  if (names.length !== game.players.length || names.length === 0) return null
  return [...names].sort((a, b) => a.localeCompare(b)).join("|||")
}

function winnerDisplayName(game: Game): string | null {
  const winner = game.players.find((p) => p.id === game.winnerId)
  return winner?.displayName?.trim() ?? null
}

/**
 * Compute ELO ratings for every pod detected across all games.
 * Games are processed in chronological order (oldest first).
 */
export function computePodElo(games: Game[]): PodEloGroup[] {
  // Group games by pod key
  const podMap = new Map<string, { label: string; players: string[]; games: Game[] }>()

  for (const game of games) {
    const key = podKeyForGame(game)
    if (!key) continue

    let entry = podMap.get(key)
    if (!entry) {
      const players = [...new Set(game.players.map((p) => p.displayName!.trim()))].sort((a, b) => a.localeCompare(b))
      entry = { label: players.join(", "), players, games: [] }
      podMap.set(key, entry)
    }
    entry.games.push(game)
  }

  const result: PodEloGroup[] = []

  for (const [podKey, { label, players, games: podGames }] of podMap) {
    // Sort oldest-first for chronological ELO processing
    const sorted = [...podGames].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
    )

    const ratings = new Map<string, number>()
    for (const name of players) ratings.set(name, DEFAULT_ELO)

    const histories = new Map<string, PodEloSnapshot[]>()
    const winCounts = new Map<string, number>()
    const gameCounts = new Map<string, number>()
    for (const name of players) {
      histories.set(name, [])
      winCounts.set(name, 0)
      gameCounts.set(name, 0)
    }

    for (let gi = 0; gi < sorted.length; gi++) {
      const game = sorted[gi]
      const wName = winnerDisplayName(game)
      const gamePlayers = game.players
        .map((p) => p.displayName?.trim())
        .filter(Boolean) as string[]

      if (!wName) continue

      const updated = multiplayerEloUpdate(ratings, gamePlayers, wName)

      for (const name of gamePlayers) {
        const newRating = updated.get(name) ?? DEFAULT_ELO
        ratings.set(name, newRating)
        gameCounts.set(name, (gameCounts.get(name) ?? 0) + 1)
        if (name === wName) winCounts.set(name, (winCounts.get(name) ?? 0) + 1)

        histories.get(name)?.push({
          gameIndex: gi + 1,
          gameId: game.id,
          date: game.playedAt,
          rating: newRating,
        })
      }
    }

    const podPlayers: PodPlayerElo[] = players.map((name) => ({
      name,
      currentRating: ratings.get(name) ?? DEFAULT_ELO,
      history: histories.get(name) ?? [],
      wins: winCounts.get(name) ?? 0,
      games: gameCounts.get(name) ?? 0,
    }))

    result.push({
      podKey,
      label,
      players: podPlayers,
      totalGames: sorted.length,
    })
  }

  // Sort pods: most games first
  return result.sort((a, b) => b.totalGames - a.totalGames)
}

// ─── Commander ELO ──────────────────────────────────────────────────────────

/**
 * Compute ELO ratings for commanders the user ("me") has played.
 *
 * Each game the user participated in is a multiplayer match between the
 * commanders present.  All commanders in those games get ELO updates, but
 * only the commanders the user personally piloted are returned.
 * Games are processed chronologically.
 */
export function computeCommanderElo(games: Game[]): CommanderEloEntry[] {
  const myGames = games.filter((g) => g.players.some((p) => p.isMe))
  const sorted = [...myGames].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
  )

  const ratings = new Map<string, number>()
  const histories = new Map<string, PodEloSnapshot[]>()
  const winCounts = new Map<string, number>()
  const gameCounts = new Map<string, number>()
  const metaMap = new Map<string, { manaCost?: string; imageUri?: string }>()
  const myCommanders = new Set<string>()

  // Track per-commander game index for the x-axis
  const perCommanderGameIndex = new Map<string, number>()

  for (let gi = 0; gi < sorted.length; gi++) {
    const game = sorted[gi]
    const winner = game.players.find((p) => p.id === game.winnerId)
    if (!winner) continue
    const winnerCmd = winner.commanderName

    const commanders = game.players.map((p) => p.commanderName)

    // Track which commanders "I" have played
    const me = getMe(game)
    if (me) myCommanders.add(me.commanderName)

    // Initialize any new commanders
    for (const p of game.players) {
      const cmd = p.commanderName
      if (!ratings.has(cmd)) {
        ratings.set(cmd, DEFAULT_ELO)
        histories.set(cmd, [])
        winCounts.set(cmd, 0)
        gameCounts.set(cmd, 0)
        perCommanderGameIndex.set(cmd, 0)
        metaMap.set(cmd, { manaCost: p.commanderManaCost, imageUri: p.commanderImageUri })
      }
    }

    const updated = multiplayerEloUpdate(ratings, commanders, winnerCmd)

    for (const cmd of commanders) {
      const newRating = updated.get(cmd) ?? DEFAULT_ELO
      ratings.set(cmd, newRating)
      gameCounts.set(cmd, (gameCounts.get(cmd) ?? 0) + 1)
      if (cmd === winnerCmd) winCounts.set(cmd, (winCounts.get(cmd) ?? 0) + 1)

      const idx = (perCommanderGameIndex.get(cmd) ?? 0) + 1
      perCommanderGameIndex.set(cmd, idx)

      histories.get(cmd)?.push({
        gameIndex: idx,
        gameId: game.id,
        date: game.playedAt,
        rating: newRating,
      })
    }
  }

  // Only return commanders the user has personally played
  const result: CommanderEloEntry[] = []
  for (const name of myCommanders) {
    const rating = ratings.get(name) ?? DEFAULT_ELO
    result.push({
      name,
      manaCost: metaMap.get(name)?.manaCost,
      imageUri: metaMap.get(name)?.imageUri,
      currentRating: rating,
      history: histories.get(name) ?? [],
      wins: winCounts.get(name) ?? 0,
      games: gameCounts.get(name) ?? 0,
    })
  }

  // Sort by current rating descending
  return result.sort((a, b) => b.currentRating - a.currentRating)
}
