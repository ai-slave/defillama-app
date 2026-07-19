import { describe, expect, it } from 'vitest'
import { buildAscendingPriceChartSource, formatPriceSeriesFromCoinsChart } from './queries'

describe('Token PnL price chart data', () => {
	it('uses the API chronological array directly', () => {
		const prices = [
			{ timestamp: 1, price: 10 },
			{ timestamp: 2, price: 20 }
		]

		expect(formatPriceSeriesFromCoinsChart(prices)).toBe(prices)
		expect(formatPriceSeriesFromCoinsChart(undefined)).toEqual([])
	})

	it('merges synthetic range boundaries without sorting the API series', () => {
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
			{ timestamp: 90_000, 'Token Price': 9 },
			{ timestamp: 100_000, 'Token Price': 9 },
			{ timestamp: 105_000, 'Token Price': 11 },
			{ timestamp: 110_000, 'Token Price': 11 }
		])
	})
})
