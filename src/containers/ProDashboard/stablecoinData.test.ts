import { describe, expect, it } from 'vitest'
import type {
	StablecoinChartResponse,
	StablecoinListAsset,
	StablecoinsListResponse
} from '~/containers/Stablecoins/api.types'
import { buildTotalMcapPayload } from '~/containers/Stablecoins/chartSeries'
import { buildStablecoinsChartCacheValue, buildStablecoinsTableData } from './stablecoinData'

const baseAsset: StablecoinListAsset = {
	id: 'asset-1',
	name: 'Stable One',
	symbol: 'ONE',
	gecko_id: null,
	chains: ['Ethereum'],
	pegType: 'peggedUSD',
	pegMechanism: 'fiat-backed',
	price: 1,
	circulating: { peggedUSD: 10 },
	circulatingPrevDay: { peggedUSD: 9 },
	circulatingPrevWeek: { peggedUSD: 8 },
	circulatingPrevMonth: { peggedUSD: 7 },
	chainCirculating: {}
}

const peggedData: StablecoinsListResponse = {
	peggedAssets: [baseAsset],
	chains: []
}

const chartData: StablecoinChartResponse = {
	aggregated: [],
	breakdown: {
		'asset-1': [{ date: '1', totalCirculatingUSD: { peggedUSD: 10 } }]
	},
	doublecountedIds: ['asset-1']
}

const peggedConfig = { 'stable-one': 'asset-1', 'usda-primary': '405', 'usda-secondary': '192' }

function build(chainData: StablecoinChartResponse) {
	return buildStablecoinsChartCacheValue({
		peggedData,
		chainData,
		chain: 'All'
	})
}

describe('buildStablecoinsChartCacheValue', () => {
	it('maps chart-response double-count IDs to asset indexes', () => {
		const result = build(chartData)

		expect(result.doublecountedIds).toEqual([0])
		expect(result.chartDataByPeggedAsset[0]).toEqual([{ date: 1, mcap: { peggedUSD: 10 } }])
		expect(result.pieAssets).toEqual([{ symbol: 'ONE', mcap: 10, aggregateIncluded: false }])
	})

	it('keeps producer-supplied histories compact without extending stale series', () => {
		const currentAsset: StablecoinListAsset = {
			...baseAsset,
			id: 'asset-2',
			name: 'Stable Two',
			symbol: 'TWO'
		}
		const result = buildStablecoinsChartCacheValue({
			peggedData: { ...peggedData, peggedAssets: [...peggedData.peggedAssets, currentAsset] },
			chainData: {
				aggregated: [],
				breakdown: {
					'asset-1': [{ date: '1', totalCirculatingUSD: { peggedUSD: 10 } }],
					'asset-2': [
						{ date: '1', totalCirculatingUSD: { peggedUSD: 20 } },
						{ date: '86401', totalCirculatingUSD: { peggedUSD: 30 } }
					]
				},
				doublecountedIds: []
			},
			chain: 'All'
		})

		expect(result.chartDataByPeggedAsset.map((series) => series.length)).toEqual([1, 2])
		expect(result.pieAssets).toEqual([
			{ symbol: 'ONE', mcap: 10, aggregateIncluded: true },
			{ symbol: 'TWO', mcap: 30, aggregateIncluded: true }
		])
		expect(
			buildTotalMcapPayload({
				chartDataByAssetOrChain: result.chartDataByPeggedAsset,
				assetsOrChainsList: result.peggedAssetNames,
				issuanceType: 'mcap',
				selectedChain: 'All'
			}).dataset.source
		).toEqual([
			[1_000, 30],
			[86_401_000, 30]
		])
	})

	it('keeps ended history but removes it from current snapshots while preserving active zero', () => {
		const endedAsset = { ...baseAsset, deadFrom: '2026-01-01' }
		const zeroAsset: StablecoinListAsset = {
			...baseAsset,
			id: 'asset-2',
			name: 'Stable Zero',
			symbol: 'ZERO'
		}
		const lifecycleChartData: StablecoinChartResponse = {
			aggregated: [],
			breakdown: {
				'asset-1': [{ date: '1', totalCirculatingUSD: { peggedUSD: 10 } }],
				'asset-2': [{ date: '1', totalCirculatingUSD: { peggedUSD: 0 } }]
			},
			doublecountedIds: []
		}
		const lifecyclePeggedData = { ...peggedData, peggedAssets: [endedAsset, zeroAsset] }
		const cache = buildStablecoinsChartCacheValue({
			peggedData: lifecyclePeggedData,
			chainData: lifecycleChartData,
			chain: 'All'
		})
		const rows = buildStablecoinsTableData({
			baseline: {
				peggedData: lifecyclePeggedData,
				priceData: [],
				rateData: [],
				peggedConfig: { ...peggedConfig, 'stable-zero': 'asset-2' }
			},
			chainData: lifecycleChartData,
			chain: 'All'
		})

		expect(cache.chartDataByPeggedAsset[0]).toEqual([{ date: 1, mcap: { peggedUSD: 10 } }])
		expect(cache.pieAssets).toEqual([
			{ symbol: 'ONE', mcap: null, aggregateIncluded: true },
			{ symbol: 'ZERO', mcap: 0, aggregateIncluded: true }
		])
		expect(rows.map((row) => row.mcap)).toEqual([null, 0])
	})

	it('constructs table rows from a shared baseline without changing values', () => {
		const rows = buildStablecoinsTableData({
			baseline: { peggedData, priceData: [], rateData: [], peggedConfig },
			chainData: chartData,
			chain: 'All'
		})

		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({
			name: 'Stable One',
			slug: 'stable-one',
			symbol: 'ONE',
			mcap: 10,
			doublecounted: true,
			price: 1,
			chains: ['Ethereum'],
			pegType: 'peggedUSD'
		})
	})

	it('keeps unavailable price and change metrics null instead of inventing $1 and 0%', () => {
		const unknownMetrics = {
			...baseAsset,
			price: null,
			circulatingPrevDay: {},
			circulatingPrevWeek: {},
			circulatingPrevMonth: {}
		}
		const rows = buildStablecoinsTableData({
			baseline: {
				peggedData: { ...peggedData, peggedAssets: [unknownMetrics] },
				priceData: [],
				rateData: [],
				peggedConfig
			},
			chainData: chartData,
			chain: 'All'
		})

		expect(rows[0]).toMatchObject({ price: null, change_1d: null, change_7d: null, change_1m: null })
	})

	it('keeps duplicate display names tied to their stable asset IDs', () => {
		const duplicatePeggedData: StablecoinsListResponse = {
			...peggedData,
			peggedAssets: [
				{ ...baseAsset, id: '405', name: 'USDA', symbol: 'USDA' },
				{ ...baseAsset, id: '192', name: 'USDA', symbol: 'USDA' }
			]
		}
		const duplicateChartData: StablecoinChartResponse = {
			aggregated: [],
			breakdown: {
				'405': [{ date: '1', totalCirculatingUSD: { peggedUSD: 40 } }],
				'192': [{ date: '1', totalCirculatingUSD: { peggedUSD: 85 } }]
			},
			doublecountedIds: []
		}

		const cache = buildStablecoinsChartCacheValue({
			peggedData: duplicatePeggedData,
			chainData: duplicateChartData,
			chain: 'All'
		})
		const rows = buildStablecoinsTableData({
			baseline: { peggedData: duplicatePeggedData, priceData: [], rateData: [], peggedConfig },
			chainData: duplicateChartData,
			chain: 'All'
		})

		expect(cache.peggedAssetIdToChartDataIndex).toEqual({ '192': 1, '405': 0 })
		expect(cache.peggedAssetNames).toEqual(['USDA', 'USDA (192)'])
		expect(cache.pieAssets).toEqual([
			{ symbol: 'USDA', mcap: 40, aggregateIncluded: true },
			{ symbol: 'USDA (192)', mcap: 85, aggregateIncluded: true }
		])
		expect(
			cache.chartDataByPeggedAsset.map((history) => {
				const first = history[0]
				if (!first) throw new Error('Expected stablecoin chart history')
				return first.mcap.peggedUSD
			})
		).toEqual([40, 85])
		expect(rows.map((row) => row.mcap)).toEqual([40, 85])
		expect(
			buildTotalMcapPayload({
				chartDataByAssetOrChain: cache.chartDataByPeggedAsset,
				assetsOrChainsList: cache.peggedAssetNames,
				filteredIndexes: cache.chartDataByPeggedAsset.map((_, index) => index),
				issuanceType: 'mcap',
				selectedChain: 'All'
			}).dataset.source
		).toEqual([[1_000, 125]])
	})
})
