import { describe, expect, test } from 'vitest'
import type { EmissionEvent } from '../api.types'
import { nextUnlockIntro, unlockIndexIntro } from '../unlockIntro'

const DATE = Date.UTC(2026, 9, 14) / 1000

describe('unlock intros', () => {
	test('states the next 7 days of unlock value', () => {
		expect(unlockIndexIntro(DATE, 228.87e6)).toBe(
			'Token unlocks are the scheduled release of vested tokens. On Oct 14, 2026 upcoming unlocks over the next 7 days total $228.87m.'
		)
	})

	test('states the next unlock amount', () => {
		const event = {
			description: 'Cliff',
			category: 'Team',
			unlockType: 'cliff',
			timestamp: DATE,
			noOfTokens: [12_400_000]
		} as EmissionEvent

		expect(nextUnlockIntro({ symbol: 'TIA', event })).toBe('The next TIA unlock is Oct 14, 2026, releasing 12.4m TIA.')
	})

	test('omits the next unlock when the amount is unknown', () => {
		const event = {
			description: 'Cliff',
			category: 'Team',
			unlockType: 'cliff',
			timestamp: DATE,
			noOfTokens: [],
			hasUnknownTokenAmount: true
		} as EmissionEvent

		expect(nextUnlockIntro({ symbol: 'TIA', event })).toBeNull()
	})
})
