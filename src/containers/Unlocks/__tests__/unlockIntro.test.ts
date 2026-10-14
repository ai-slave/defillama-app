import { describe, expect, test } from 'vitest'
import type { EmissionEvent } from '../api.types'
import { nextUnlockIntro, unlockIndexIntro } from '../unlockIntro'

const DATE = Date.UTC(2026, 9, 14) / 1000

function cliff(amount: number | null): EmissionEvent {
	if (amount == null) {
		return {
			description: 'Cliff',
			category: 'Team',
			unlockType: 'cliff',
			timestamp: DATE,
			noOfTokens: [],
			hasUnknownTokenAmount: true
		}
	}
	return {
		description: 'Cliff',
		category: 'Team',
		unlockType: 'cliff',
		timestamp: DATE,
		noOfTokens: [amount]
	}
}

function linear(weekly: number | null): EmissionEvent {
	if (weekly == null) {
		return {
			description: 'Linear',
			category: 'Team',
			unlockType: 'linear',
			timestamp: DATE,
			noOfTokens: [],
			rateDurationDays: 365,
			hasUnknownTokenAmount: true
		}
	}
	return {
		description: 'Linear',
		category: 'Team',
		unlockType: 'linear',
		timestamp: DATE,
		noOfTokens: [1_000_000, weekly],
		rateDurationDays: 365
	}
}

describe('unlock intros', () => {
	test('states the next 7 days of unlock value', () => {
		expect(unlockIndexIntro(DATE, 228.87e6)).toBe(
			'Token unlocks are the scheduled release of vested tokens. On Oct 14, 2026 upcoming unlocks over the next 7 days total $228.87m.'
		)
	})

	test('states one cliff as a lump sum', () => {
		expect(nextUnlockIntro({ symbol: 'TIA', events: [cliff(12_400_000)] })).toBe(
			'The next TIA unlock is Oct 14, 2026, releasing 12.4m TIA.'
		)
	})

	test('sums every cliff at the next timestamp', () => {
		expect(nextUnlockIntro({ symbol: 'TIA', events: [cliff(2_000_000), cliff(4_000_000)] })).toBe(
			'The next TIA unlock is Oct 14, 2026, releasing 6m TIA.'
		)
	})

	test('describes a linear event as tokens per week', () => {
		expect(nextUnlockIntro({ symbol: 'TIA', events: [linear(500_000)] })).toBe(
			'The next TIA unlock is Oct 14, 2026, releasing 500k TIA per week.'
		)
	})

	test('keeps a cliff lump sum and a weekly rate apart', () => {
		expect(nextUnlockIntro({ symbol: 'TIA', events: [cliff(2_000_000), linear(500_000)] })).toBe(
			'The next TIA unlock is Oct 14, 2026, releasing 2m TIA on that date and 500k TIA per week.'
		)
	})

	test('says when part of the amount is unpublished', () => {
		expect(nextUnlockIntro({ symbol: 'TIA', events: [cliff(2_000_000), cliff(null)] })).toBe(
			'The next TIA unlock is Oct 14, 2026, releasing 2m TIA. Some of the amount is not published.'
		)
	})

	test('omits the next unlock when every amount is unknown', () => {
		expect(nextUnlockIntro({ symbol: 'TIA', events: [cliff(null)] })).toBeNull()
	})
})
