import type { Game, WinRateStat, SeatStats, ComputedStats, SeatPosition, MtgColor } from "@/types"

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

      const { commanderGames, ...rest } = entry
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
