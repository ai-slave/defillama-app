import { describe, expect, it } from 'vitest'
import type { EmissionEvent } from '../api.types'
import {
	getCliffEmissionAmount,
	getEmissionAmountOverInterval,
	getEmissionEventAmount,
	getLinearEmissionRateDelta,
	getLinearEmissionWeeklyRate
} from '../eventAmount'

function event(overrides: EmissionEvent): EmissionEvent {
	return overrides
}

describe('emission event amounts', () => {
	it('reads a cliff as a one-time token amount', () => {
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

	it.each([
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

	it('keeps an unavailable amount distinct from a known zero', () => {
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
		expect(getEmissionAmountOverInterval(unknown, 8 * 86400, 9 * 86400)).toBe(0)
	})

	it('counts cliffs only inside the requested half-open interval', () => {
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

	it('integrates the new weekly rate over the interval overlap', () => {
		const startTimestampSec = 86400
		const linear = event({
			description: 'Linear rate change',
			category: 'farming',
			unlockType: 'linear',
			timestamp: startTimestampSec,
			noOfTokens: [100, 14],
			rateDurationDays: 2
		})

		expect(getEmissionAmountOverInterval(linear, startTimestampSec, startTimestampSec + 86400)).toBe(2)
		expect(getEmissionAmountOverInterval(linear, startTimestampSec + 43200, startTimestampSec + 86400)).toBe(1)
		expect(getEmissionAmountOverInterval(linear, startTimestampSec, startTimestampSec + 3 * 86400)).toBe(4)
		expect(getEmissionAmountOverInterval(linear, startTimestampSec + 2 * 86400, startTimestampSec + 3 * 86400)).toBe(0)
	})
})
