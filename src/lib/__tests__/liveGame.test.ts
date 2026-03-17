import { describe, expect, it } from "vitest"

import { buildLiveGameSession, changeCommanderDamage, changePlayerCounter } from "@/lib/liveGame"
import type { LiveGameSetup, Player } from "@/types"

function makePlayer(id: string, seatPosition: Player["seatPosition"]): Player {
	return {
		id,
		isMe: id === "p1",
		commanderName: `Commander ${id}`,
		seatPosition,
		fastMana: { hasFastMana: false, cards: [] },
	}
}

function makeSetup(): LiveGameSetup {
	return {
		startingPlayerId: "p1",
		players: [
			makePlayer("p1", 1),
			makePlayer("p2", 2),
			makePlayer("p3", 3),
			makePlayer("p4", 4),
		],
	}
}

function getPlayerLife(session: ReturnType<typeof buildLiveGameSession>, playerId: string) {
	const player = session.players.find((candidate) => candidate.id === playerId)
	expect(player).toBeDefined()
	return player!
}

describe("liveGame lethal condition updates", () => {
	it("eliminates and revives a player based on life total", () => {
		const session = buildLiveGameSession(makeSetup(), 1)

		const knockedOut = changePlayerCounter(session, "p2", "life", -40, 2)
		expect(getPlayerLife(knockedOut, "p2").lifeTotal).toBe(0)
		expect(getPlayerLife(knockedOut, "p2").isEliminated).toBe(true)

		const revived = changePlayerCounter(knockedOut, "p2", "life", 1, 3)
		expect(getPlayerLife(revived, "p2").lifeTotal).toBe(1)
		expect(getPlayerLife(revived, "p2").isEliminated).toBe(false)
		expect(getPlayerLife(revived, "p2").eliminatedAtTurn).toBeUndefined()
	})

	it("eliminates and revives a player based on poison counters", () => {
		const session = buildLiveGameSession(makeSetup(), 1)

		const knockedOut = changePlayerCounter(session, "p2", "poison", 10, 2)
		expect(getPlayerLife(knockedOut, "p2").poisonCounters).toBe(10)
		expect(getPlayerLife(knockedOut, "p2").isEliminated).toBe(true)

		const revived = changePlayerCounter(knockedOut, "p2", "poison", -1, 3)
		expect(getPlayerLife(revived, "p2").poisonCounters).toBe(9)
		expect(getPlayerLife(revived, "p2").isEliminated).toBe(false)
	})

	it("eliminates and revives a player when commander damage crosses 21", () => {
		const session = buildLiveGameSession(makeSetup(), 1)

		const knockedOut = changeCommanderDamage(session, "p2", "p1", 21, 2)
		expect(getPlayerLife(knockedOut, "p2").commanderDamageTakenByPlayerId).toEqual({ p1: 21 })
		expect(getPlayerLife(knockedOut, "p2").lifeTotal).toBe(19)
		expect(getPlayerLife(knockedOut, "p2").isEliminated).toBe(true)

		const revived = changeCommanderDamage(knockedOut, "p2", "p1", -1, 3)
		expect(getPlayerLife(revived, "p2").commanderDamageTakenByPlayerId).toEqual({ p1: 20 })
		expect(getPlayerLife(revived, "p2").lifeTotal).toBe(20)
		expect(getPlayerLife(revived, "p2").isEliminated).toBe(false)
		expect(getPlayerLife(revived, "p2").eliminatedAtTurn).toBeUndefined()
	})

	it("does not revive a player if another lethal condition still applies", () => {
		const session = buildLiveGameSession(makeSetup(), 1)

		const withPoison = changePlayerCounter(session, "p2", "poison", 10, 2)
		const withPoisonAndCommander = changeCommanderDamage(withPoison, "p2", "p1", 21, 3)
		expect(getPlayerLife(withPoisonAndCommander, "p2").isEliminated).toBe(true)

		const stillOut = changeCommanderDamage(withPoisonAndCommander, "p2", "p1", -1, 4)
		expect(getPlayerLife(stillOut, "p2").commanderDamageTakenByPlayerId).toEqual({ p1: 20 })
		expect(getPlayerLife(stillOut, "p2").poisonCounters).toBe(10)
		expect(getPlayerLife(stillOut, "p2").isEliminated).toBe(true)
	})
	})
