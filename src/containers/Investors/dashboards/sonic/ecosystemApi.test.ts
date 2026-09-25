import { describe, expect, test } from 'vitest'
import { buildEcosystemViewModel, type EcosystemAPIResponse } from './ecosystemApi'

const formattedValue = { value: 1, formatted: '$1' }
const overviewKpis = {
	total24h: formattedValue,
	total7d: formattedValue,
	total30d: formattedValue,
	totalAllTime: formattedValue,
	change1d: formattedValue,
	change7d: formattedValue,
	change1m: formattedValue
}
const topProtocol = {
	name: 'Protocol',
	logo: null,
	category: 'DEX',
	total24h: 1,
	total24hFormatted: '$1',
	total7d: 2,
	total30d: 3,
	totalAllTime: 4
}

function buildResponse(): EcosystemAPIResponse {
	return {
		tvl: {
			tvl: {
				title: 'TVL',
				current: 20,
				currentFormatted: '$20',
				dates: ['2026-07-16', '2026-07-17'],
				series: [
					{ name: 'Sonic TVL', data: [10, 20] },
					{ name: 'Short TVL', data: [4] }
				]
			}
		},
		fees: {
			feesChart: {
				title: 'Fees',
				dates: ['2026-07-16'],
				series: [{ name: 'Protocol Fees', data: [3] }]
			},
			kpis: overviewKpis,
			topProtocols: [topProtocol]
		},
		dexVolume: {
			volumeChart: {
				title: 'DEX Volume',
				dates: ['2026-07-16'],
				series: [{ name: 'DEX', data: [5] }]
			},
			kpis: overviewKpis,
			topDexes: [topProtocol]
		},
		stablecoins: {
			stablecoinChart: {
				title: 'Stablecoins',
				dates: ['2026-07-16', '2026-07-17'],
				series: [
					{ name: 'Total Circulating', data: [900, 1000] },
					{ name: 'DAI', data: [40, 100] },
					{ name: 'USDC', data: [100, 200] },
					{ name: 'USDT', data: [30, 0] },
					{ name: 'EURC', data: [50] }
				]
			},
			kpis: {
				currentCirculating: formattedValue,
				currentMinted: formattedValue,
				currentBridged: formattedValue
			}
		},
		chainAssets: {
			assetBreakdown: {
				title: 'Chain Assets',
				total: 30,
				totalFormatted: '$30',
				categories: [
					{ name: 'native', value: 20, formatted: '$20', pct: 66.7, breakdown: { S: 20 } },
					{ name: 'total', value: 30, formatted: '$30', pct: 100, breakdown: {} },
					{ name: 'bridged', value: 10, formatted: '$10', pct: 33.3, breakdown: { USDC: 10 } }
				]
			}
		}
	}
}

describe('buildEcosystemViewModel', () => {
	test('zero-fills a shorter TVL series on the shared date axis', () => {
		expect(buildEcosystemViewModel(buildResponse()).tvl.dataset).toEqual({
			dimensions: ['timestamp', 'Sonic TVL', 'Short TVL'],
			source: [
				[Date.UTC(2026, 6, 16), 10, 4],
				[Date.UTC(2026, 6, 17), 20, 0]
			]
		})
	})

	test('excludes aggregate and empty stablecoin slices while reusing enriched pie rows', () => {
		const result = buildEcosystemViewModel(buildResponse())

		expect(result.stablecoins.dataset).toEqual({
			dimensions: ['timestamp', 'DAI', 'USDC', 'USDT', 'EURC'],
			source: [
				[Date.UTC(2026, 6, 16), 40, 100, 30, 50],
				[Date.UTC(2026, 6, 17), 100, 200, 0, 0]
			]
		})
		expect(result.stablecoins.charts).toMatchObject([
			{ name: 'DAI', type: 'line', stack: 'Total' },
			{ name: 'USDC', type: 'line', stack: 'Total' },
			{ name: 'USDT', type: 'line', stack: 'Total' },
			{ name: 'EURC', type: 'line', stack: 'Total' }
		])
		expect(result.stablecoins.breakdown).toEqual([
			{ name: 'USDC', value: 200, formatted: '$200.00', pct: '66.7' },
			{ name: 'DAI', value: 100, formatted: '$100.00', pct: '33.3' }
		])
		expect(result.stablecoins.breakdownTotalFormatted).toBe('$300.00')
		expect(result.stablecoins).not.toHaveProperty('pieData')
		expect(result.chainAssets.categories.map((category) => category.name)).toEqual(['native', 'bridged'])
		expect(result.chainAssets).not.toHaveProperty('pieData')
	})

	test('keeps empty stablecoin histories empty without creating breakdown slices', () => {
		const response = buildResponse()
		response.stablecoins.stablecoinChart.dates = []
		response.stablecoins.stablecoinChart.series = [
			{ name: 'Total Circulating', data: [] },
			{ name: 'USDC', data: [] }
		]
		const result = buildEcosystemViewModel(response)

		expect(result.stablecoins.dataset.source).toEqual([])
		expect(result.stablecoins.breakdown).toEqual([])
		expect(result.stablecoins.breakdownTotalFormatted).toBe('$0.00')
	})
})
