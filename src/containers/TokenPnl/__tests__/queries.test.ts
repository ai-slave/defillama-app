import { describe, expect, test } from 'vitest'
import { COINS_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { buildAscendingPriceChartSource, computeTokenPnl } from '../queries'

const http = installFixtureFetch()
const DAY = 86_400
const START = 1_700_000_000

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

describe('Token PnL annualised return', () => {
	async function annualisedOver(days: number, startPrice: number, endPrice: number) {
		const end = START + days * DAY
		http.serve({
			[`${COINS_SERVER_URL}/chart/`]: {
				coins: {
					'coingecko:token': {
						prices: [
							{ timestamp: START, price: startPrice },
							{ timestamp: end, price: endPrice }
						]
					}
				}
			}
		})
		const result = await computeTokenPnl({ id: 'token', start: START, end })
		return result!.metrics.annualizedReturn
	}

	test('is not shown for a window under a year, where a big one-day move used to overflow to Infinity', async () => {
		expect(await annualisedOver(1, 1, 8)).toBeNull()
		expect(await annualisedOver(364, 100, 105)).toBeNull()
	})

	test('compounds a window of a year or more to a yearly rate', async () => {
		expect(await annualisedOver(365, 100, 120)).toBeCloseTo(20, 6)
		// 1.8 over two years is sqrt(1.8) a year.
		expect(await annualisedOver(730, 100, 180)).toBeCloseTo(34.1641, 4)
		expect(await annualisedOver(730, 100, 0)).toBeCloseTo(-100, 4)
	})
})
