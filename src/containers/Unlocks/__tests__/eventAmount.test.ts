import { describe, expect, test } from 'vitest'
import intervalFixtures from '../__fixtures__/intervalFixtures.json'
import { normalizeEmissionEvents } from '../api'
import type { EmissionEvent, RawEmissionEvent } from '../api.types'
import {
	getCliffEmissionAmount,
	getEmissionAmountBreakdownOverInterval,
	getEmissionAmountOverInterval,
	getEmissionEventAmount,
	getLinearEmissionRateDelta,
	getLinearEmissionWeeklyRate
} from '../eventAmount'

function event(overrides: EmissionEvent): EmissionEvent {
	return overrides
}

describe('emission event amounts', () => {
	test('reads a cliff as a one-time token amount', () => {
		const cliff = event({
			description: 'Cliff',
			category: 'insiders',
			unlockType: 'cliff',
			timestamp: 1,
			noOfTokens: [12]
		})

		expect(getEmissionEventAmount(cliff)).toBe(12)
		expect(getCliffEmissionAmount(cliff)).toBe(12)
		expect(getLinearEmissionWeeklyRate(cliff)).toBeNull()
		expect(getLinearEmissionRateDelta(cliff)).toBeNull()
	})

	test.each([
		[10, 14, 14, 4],
		[10, 4, 4, -6],
		[10, 10, 10, 0],
		[10, 0, 0, -10]
	])('reads a linear tuple as previous/new weekly rates', (previous, next, amount, delta) => {
		const linear = event({
			description: 'Linear rate change',
			category: 'farming',
			unlockType: 'linear',
			timestamp: 1,
			noOfTokens: [previous, next],
			rateDurationDays: 7
		})

		expect(getEmissionEventAmount(linear)).toBe(amount)
		expect(getCliffEmissionAmount(linear)).toBeNull()
		expect(getLinearEmissionWeeklyRate(linear)).toBe(amount)
		expect(getLinearEmissionRateDelta(linear)).toBe(delta)
	})

	test('integrates a known new rate when the previous rate is unavailable', () => {
		const linear = event({
			description: 'Linear rate change',
			category: 'farming',
			unlockType: 'linear',
			timestamp: 0,
			noOfTokens: [null, 7],
			rateDurationDays: 1
		})

		expect(getLinearEmissionWeeklyRate(linear)).toBe(7)
		expect(getLinearEmissionRateDelta(linear)).toBeNull()
		expect(getEmissionAmountOverInterval(linear, 0, 86_400)).toBe(1)
	})

	test('keeps an unavailable amount distinct from a known zero', () => {
		const unknown = event({
			description: 'Unknown',
			category: 'farming',
			unlockType: 'linear',
			timestamp: 1,
			noOfTokens: [],
			rateDurationDays: 7,
			hasUnknownTokenAmount: true
		})

		expect(getEmissionEventAmount(unknown)).toBeNull()
		expect(getCliffEmissionAmount(unknown)).toBeNull()
		expect(getLinearEmissionWeeklyRate(unknown)).toBeNull()
		expect(getLinearEmissionRateDelta(unknown)).toBeNull()
		expect(getEmissionAmountOverInterval(unknown, 1, 2)).toBeNull()
		expect(getEmissionAmountOverInterval(unknown, 8 * 86_400, 9 * 86_400)).toBe(0)
	})

	test('counts cliffs only inside the requested half-open interval', () => {
		const cliff = event({
			description: 'Cliff',
			category: 'insiders',
			unlockType: 'cliff',
			timestamp: 10,
			noOfTokens: [12]
		})

		expect(getEmissionAmountOverInterval(cliff, 10, 20)).toBe(12)
		expect(getEmissionAmountOverInterval(cliff, 0, 10)).toBe(0)
		expect(getEmissionAmountOverInterval(cliff, 20, 10)).toBe(0)
	})

	test('integrates the new weekly rate over the interval overlap', () => {
		const startTimestampSec = 86_400
		const linear = event({
			description: 'Linear rate change',
			category: 'farming',
			unlockType: 'linear',
			timestamp: startTimestampSec,
			noOfTokens: [100, 14],
			rateDurationDays: 2
		})

		expect(getEmissionAmountOverInterval(linear, startTimestampSec, startTimestampSec + 86_400)).toBe(2)
		expect(getEmissionAmountOverInterval(linear, startTimestampSec + 43_200, startTimestampSec + 86_400)).toBe(1)
		expect(getEmissionAmountOverInterval(linear, startTimestampSec, startTimestampSec + 3 * 86_400)).toBe(4)
		expect(getEmissionAmountOverInterval(linear, startTimestampSec + 2 * 86_400, startTimestampSec + 3 * 86_400)).toBe(
			0
		)
	})

	test('does not subtract signed burns from unlock totals', () => {
		const burns: Array<EmissionEvent> = [
			event({
				description: 'Cliff burn',
				category: 'burn',
				unlockType: 'cliff',
				timestamp: 1,
				noOfTokens: [-10]
			}),
			event({
				description: 'Linear burn',
				category: 'burn',
				unlockType: 'linear',
				timestamp: 0,
				noOfTokens: [5, -7],
				rateDurationDays: 2
			})
		]

		expect(getEmissionAmountBreakdownOverInterval(burns, 0, 2 * 86_400)).toEqual({
			cliff: 0,
			linear: 0,
			total: 0,
			unknownEventCount: 0
		})
	})

	test.each(intervalFixtures)('matches the $name fixture', (fixture) => {
		const events = normalizeEmissionEvents(fixture.events as unknown as Array<RawEmissionEvent>)

		expect(getEmissionAmountBreakdownOverInterval(events, fixture.startTimestampSec, fixture.endTimestampSec)).toEqual(
			fixture.expected
		)
	})
})
