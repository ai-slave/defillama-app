import { describe, expect, it } from 'vitest'
import { annualizeFunding } from './hyperliquid'

describe('annualizeFunding', () => {
	it.each([
		{ hours: 1, expected: 87.6 },
		{ hours: 4, expected: 21.9 },
		{ hours: 8, expected: 10.95 }
	])('annualizes a $hours-hour rate using its actual settlement interval', ({ hours, expected }) => {
		expect(annualizeFunding('0.0001', hours)).toBeCloseTo(expected)
	})

	it('rejects missing rates and invalid intervals', () => {
		expect(annualizeFunding(null, 1)).toBeNull()
		expect(annualizeFunding('0.0001', 0)).toBeNull()
	})
})
