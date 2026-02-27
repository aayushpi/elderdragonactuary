#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function parseImportJson(json) {
  const parsed = JSON.parse(json)
  let rawGames
  if (Array.isArray(parsed)) rawGames = parsed
  else if (parsed.games && Array.isArray(parsed.games)) rawGames = parsed.games
  else throw new Error('Invalid format — expected a games array.')

  return rawGames.map((g) => {
    // clean export format uses winnerIndex
    if (typeof g.winnerIndex === 'number' && Array.isArray(g.players)) {
      const players = g.players.map((p, i) => ({ ...p, id: `p-${i}`, isMe: i === 0 }))
      return {
        id: `g-${Math.random().toString(36).slice(2,8)}`,
        playedAt: typeof g.playedAt === 'string' ? new Date(g.playedAt).toISOString() : new Date().toISOString(),
        winTurn: typeof g.winTurn === 'number' ? g.winTurn : 0,
        winnerId: players[g.winnerIndex]?.id ?? players[0].id,
        notes: g.notes,
        winConditions: Array.isArray(g.winConditions) ? g.winConditions : undefined,
        keyWinconCards: Array.isArray(g.keyWinconCards) ? g.keyWinconCards : undefined,
        bracket: typeof g.bracket === 'number' ? g.bracket : undefined,
        players,
      }
    }

    // legacy full Game object-ish
    const players = (g.players || []).map((p, i) => ({ ...p, id: `p-${i}`, isMe: i === 0 }))
    return { ...g, id: `g-${Math.random().toString(36).slice(2,8)}`, players }
  })
}

function adjustPlayedAts(games) {
  const playedAtGroups = new Map()
  games.forEach((g, idx) => {
    const key = g.playedAt
    const arr = playedAtGroups.get(key) || []
    arr.push(idx)
    playedAtGroups.set(key, arr)
  })
  const adjusted = new Array(games.length)
  for (const [key, indices] of playedAtGroups.entries()) {
    if (indices.length === 1) {
      adjusted[indices[0]] = key
      continue
    }
    const base = new Date(key).getTime()
    const len = indices.length
    indices.forEach((origIdx, i) => {
      const offset = len - i
      adjusted[origIdx] = new Date(base + offset).toISOString()
    })
  }
  return adjusted
}

function printOrder(title, games) {
  console.log('---', title, '---')
  games.forEach((g, i) => {
    const me = g.players && g.players[0]
    const name = me ? (me.commanderName || me.name || 'unknown') : 'no-player'
    console.log(String(i + 1).padStart(2, ' '), g.playedAt, '-', name)
  })
}

async function main() {
  const fileArg = process.argv[2] || path.join(process.env.HOME || '~', 'Desktop', 'ActuaryList.json')
  if (!fs.existsSync(fileArg)) {
    console.error('File not found:', fileArg)
    process.exit(2)
  }
  const raw = fs.readFileSync(fileArg, 'utf8')
  const games = parseImportJson(raw)

  printOrder('Original parsed order', games)

  // simulate DB rows with adjusted timestamps
  const adjusted = adjustPlayedAts(games)
  const rows = games.map((g, idx) => ({ ...g, playedAt: adjusted[idx] }))

  // simulate DB ordering by played_at desc
  const sorted = rows.slice().sort((a, b) => (a.playedAt < b.playedAt ? 1 : a.playedAt > b.playedAt ? -1 : 0))

  printOrder('After timestamp adjustment (simulated DB rows)', rows)
  printOrder('Simulated DB fetch (ordered by played_at desc)', sorted)

  // show if ordering changed
  const originalIds = games.map((g) => g.id)
  const sortedIds = sorted.map((g) => g.id)
  const same = originalIds.every((id, i) => id === sortedIds[i])
  console.log('\nOrdering preserved after simulation:', same)
}

main().catch((err) => { console.error(err); process.exit(1) })
