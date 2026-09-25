import { describe, expect, test } from 'vitest'
import { partialPeriodNote } from '../Assets'

const today = new Date('2026-09-23T12:00:00Z')

describe('RWA chart partial-period wording', () => {
	test('warns when daily data includes the current month', () => {
		expect(partialPeriodNote({ dates: ['2026-08-31', '2026-09-22'], series: [] }, today)).toContain(
			'current month and quarter are still in progress'
		)
	})

	test('omits the warning for monthly fallback or stale daily data', () => {
		expect(partialPeriodNote(undefined, today)).toBe('')
		expect(partialPeriodNote({ dates: ['2026-08-31'], series: [] }, today)).toBe('')
	})
})
