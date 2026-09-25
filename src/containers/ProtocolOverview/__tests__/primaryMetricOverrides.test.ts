import { describe, expect, test } from 'vitest'
import { getProtocolPrimaryMetricOverride } from '../primaryMetricOverrides'

describe('getProtocolPrimaryMetricOverride', () => {
	test('uses 30-day perp volume for StableJack', () => {
		expect(
			getProtocolPrimaryMetricOverride({
				metrics: { tvl: false },
				name: 'StableJack',
				perpVolume: {
					total24h: 2000,
					total7d: 14_000,
					total30d: 68_290,
					total1y: null,
					annualized1y: null,
					totalAllTime: 100_000,
					chainBreakdown: {
						Avalanche: { total24h: 500, total7d: 3500, total30d: 8290, totalAllTime: 20_000 },
						Arbitrum: { total24h: 1500, total7d: 10_500, total30d: 60_000, totalAllTime: 80_000 }
					}
				}
			})
		).toEqual({
			source: 'perpVolume',
			title: 'Perp Volume 30d',
			byChainTitle: '30d volume by chain',
			value: 68_290,
			valueByChain: [
				['Arbitrum', 60_000],
				['Avalanche', 8290]
			]
		})
	})

	test('falls back to the existing primary metric when override data is unavailable', () => {
		expect(
			getProtocolPrimaryMetricOverride({
				metrics: { tvl: false },
				name: 'StableJack',
				perpVolume: {
					total24h: 2000,
					total7d: 14_000,
					total30d: null,
					total1y: null,
					annualized1y: null,
					totalAllTime: 100_000,
					chainBreakdown: null
				}
			})
		).toBeNull()
	})
})
