import { describe, expect, test } from 'vitest'
import { buildAscendingPriceChartSource } from '../queries'

describe('Token PnL price chart data', () => {
	test('merges synthetic range boundaries without sorting the API series', () => {
		expect(
			buildAscendingPriceChartSource(
				[
					{ timestamp: 90, price: 9 },
					{ timestamp: 110, price: 11 }
				],
				100,
				105
			)
		).toEqual([
			[90_000, 9],
			[100_000, 9],
			[105_000, 11],
			[110_000, 11]
		])
	})
})
