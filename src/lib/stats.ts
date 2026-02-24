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

  // By win turn (which turn number the game ended on)
  const turnMap = new Map<number, { total: number; myWins: number }>()
  for (const game of myGames) {
    const me = getMe(game)
    if (!me) continue
    const t = game.winTurn
    const entry = turnMap.get(t) ?? { total: 0, myWins: 0 }
    entry.total++
    if (game.winnerId === me.id) entry.myWins++
    turnMap.set(t, entry)
  }
  const byWinTurn = Array.from(turnMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([turn, { total, myWins }]) => ({ turn, stat: winRate(myWins, total) }))

  // By commander
  const commanderMap = new Map<string, { wins: number; games: number; manaCost?: string; imageUri?: string }>()
  for (const game of myGames) {
    const me = getMe(game)
    if (!me) continue
    const name = me.commanderName
    const existing = commanderMap.get(name)
    if (existing) {
      existing.games++
      if (game.winnerId === me.id) existing.wins++
    } else {
      commanderMap.set(name, {
        wins: game.winnerId === me.id ? 1 : 0,
        games: 1,
        manaCost: me.commanderManaCost,
        imageUri: me.commanderImageUri,
      })
    }
  }
  const byCommander = Array.from(commanderMap.entries())
    .map(([name, { wins, games, manaCost, imageUri }]) => ({
      name,
      manaCost,
      imageUri,
      wins,
      games,
      rate: games === 0 ? 0 : wins / games,
    }))
    .sort((a, b) => b.rate - a.rate || b.games - a.games)

  // Average win turn
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
    byWinTurn,
    byCommander,
    averageWinTurn,
    gamesPlayed: myGames.length,
  }
}
