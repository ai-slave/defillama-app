import { describe, expect, test } from 'vitest'
import { stablecoinDominanceIntro } from '../hubCopy'

const DATE = Date.UTC(2026, 9, 14) / 1000

describe('stablecoinDominanceIntro', () => {
	test("states USDT's share of stablecoin market cap", () => {
		expect(
			stablecoinDominanceIntro({
				dateSec: DATE,
				totalMcap: 306e9,
				assets: [
					{ symbol: 'USDT', mcap: 184e9 },
					{ symbol: 'USDC', mcap: 73.1e9 },
					{ symbol: 'DAI', mcap: 4.7e9 },
					{ symbol: 'USDT', mcap: 1 }
				]
			})
		).toBe(
			"USDT's share of stablecoin market cap is 60.13% on Oct 14, 2026: $184b of a $306b total, ahead of USDC at $73.1b and DAI at $4.7b. It is not TradingView's USDT.D index, which measures USDT against the whole crypto market."
		)
	})

	test('omits the share when a named coin is missing', () => {
		expect(
			stablecoinDominanceIntro({
				dateSec: DATE,
				totalMcap: 306e9,
				assets: [{ symbol: 'USDT', mcap: 184e9 }]
			})
		).toBeNull()
	})
})
