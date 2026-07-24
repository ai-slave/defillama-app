import { describe, expect, it } from 'vitest'
import { computeNextBillingDate } from './billingDate'

describe('computeNextBillingDate', () => {
	it('keeps an upcoming anniversary in the current billing period', () => {
		expect(computeNextBillingDate('2026-04-16T20:02:14.302Z', 'month', new Date('2026-05-01T00:00:00Z'))).toEqual(
			new Date('2026-05-16T20:02:14.302Z')
		)
		expect(computeNextBillingDate('2025-12-15T08:00:00Z', 'year', new Date('2026-07-24T00:00:00Z'))).toEqual(
			new Date('2026-12-15T08:00:00Z')
		)
	})

	it('advances after the current billing anniversary', () => {
		expect(computeNextBillingDate('2026-04-16T20:02:14.302Z', 'month', new Date('2026-05-17T00:00:00Z'))).toEqual(
			new Date('2026-06-16T20:02:14.302Z')
		)
	})

	it('clamps month-end and leap-day anniversaries', () => {
		expect(computeNextBillingDate('2026-01-31T08:00:00Z', 'month', new Date('2026-02-01T00:00:00Z'))).toEqual(
			new Date('2026-02-28T08:00:00Z')
		)
		expect(computeNextBillingDate('2024-02-29T08:00:00Z', 'year', new Date('2025-01-01T00:00:00Z'))).toEqual(
			new Date('2025-02-28T08:00:00Z')
		)
	})
})
