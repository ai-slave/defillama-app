import { expect, test } from 'vitest'
import { formatSeatTotal } from '../Team/seatPricing'

test('prices each plan per seat for the chosen billing interval', () => {
	expect(formatSeatTotal('api', 'month', 1)).toBe('$300/month')
	expect(formatSeatTotal('api', 'year', 2)).toBe('$6,000/year')
	expect(formatSeatTotal('llamafeed', 'month', 3)).toBe('$147/month')
	expect(formatSeatTotal('llamafeed', 'year', 1)).toBe('$490/year')
})
