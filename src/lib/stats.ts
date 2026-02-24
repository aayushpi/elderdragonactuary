import type { Game, WinRateStat, SeatStats, ComputedStats, SeatPosition } from "@/types"

function winRate(wins: number, games: number): WinRateStat {
  return { wins, games, rate: games === 0 ? 0 : wins / games }
}

function getMe(game: Game) {
  return game.players.find((p) => p.isMe)
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
    .sort((a, b) => b.rate - a.rate || b.games - a.games)

  // Average win turn (overall)
  const myWins = myGames.filter((g) => {
    const me = getMe(g)
    return me && g.winnerId === me.id
  })
  const averageWinTurn =
    myWins.length === 0
      ? null
      : myWins.reduce((sum, g) => sum + g.winTurn, 0) / myWins.length

  return {
    overall,
    withFastMana,
    againstFastMana,
    bySeat,
    byCommander,
    averageWinTurn,
    gamesPlayed: myGames.length,
  }
}
