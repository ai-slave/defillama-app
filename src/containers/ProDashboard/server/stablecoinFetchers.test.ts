import { describe, expect, it } from 'vitest'
import type { StablecoinChartResponse, StablecoinsListResponse } from '~/containers/Stablecoins/api.types'
import { buildTotalMcapPayload } from '~/containers/Stablecoins/chartSeries'
import { buildStablecoinsChartCacheValue, buildStablecoinsTableData } from './stablecoinFetchers'

const peggedData: StablecoinsListResponse = {
	peggedAssets: [
		{
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
	],
	chains: []
}

const chartData: StablecoinChartResponse = {
	aggregated: [],
	breakdown: {
		'asset-1': [{ date: '1', totalCirculatingUSD: { peggedUSD: 10 } }]
	},
	doublecountedIds: ['asset-1']
}

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
		expect(result.pieAssets).toEqual([{ symbol: 'ONE', mcap: 10 }])
	})

	it('does not exclude assets when the response omits double-count metadata', () => {
		expect(build({ ...chartData, doublecountedIds: undefined }).doublecountedIds).toEqual([])
	})

	it('keeps stale chart histories compact while canonical totals carry them forward', () => {
		const currentAsset = { ...peggedData.peggedAssets[0], id: 'asset-2', name: 'Stable Two', symbol: 'TWO' }
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
				}
			},
			chain: 'All'
		})

		expect(result.chartDataByPeggedAsset.map((series) => series.length)).toEqual([1, 2])
		expect(result.pieAssets).toEqual([
			{ symbol: 'ONE', mcap: 10 },
			{ symbol: 'TWO', mcap: 30 }
		])
		expect(
			buildTotalMcapPayload({
				chartDataByAssetOrChain: result.chartDataByPeggedAsset,
				assetsOrChainsList: result.peggedAssetNames,
				issuanceType: 'mcap',
				selectedChain: 'All',
				carryForwardAfterSeriesEnd: true
			}).dataset.source
		).toEqual([
			[1_000, 30],
			[86_401_000, 40]
		])
	})

	it('constructs table rows from a shared baseline without changing values', () => {
		const rows = buildStablecoinsTableData({
			baseline: { peggedData, priceData: [], rateData: [] },
			chainData: chartData,
			chain: 'All'
		})

		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({
			name: 'Stable One',
			symbol: 'ONE',
			mcap: 10,
			price: 1,
			chains: ['Ethereum'],
			pegType: 'peggedUSD'
		})
	})

	it('keeps duplicate display names tied to their stable asset IDs', () => {
		const duplicatePeggedData: StablecoinsListResponse = {
			...peggedData,
			peggedAssets: [
				{ ...peggedData.peggedAssets[0], id: '405', name: 'USDA', symbol: 'USDA' },
				{ ...peggedData.peggedAssets[0], id: '192', name: 'USDA', symbol: 'USDA' }
			]
		}
		const duplicateChartData: StablecoinChartResponse = {
			aggregated: [],
			breakdown: {
				'405': [{ date: '1', totalCirculatingUSD: { peggedUSD: 40 } }],
				'192': [{ date: '1', totalCirculatingUSD: { peggedUSD: 85 } }]
			}
		}

		const cache = buildStablecoinsChartCacheValue({
			peggedData: duplicatePeggedData,
			chainData: duplicateChartData,
			chain: 'All'
		})
		const rows = buildStablecoinsTableData({
			baseline: { peggedData: duplicatePeggedData, priceData: [], rateData: [] },
			chainData: duplicateChartData,
			chain: 'All'
		})

		expect(cache.peggedAssetIdToChartDataIndex).toEqual({ '192': 1, '405': 0 })
		expect(cache.peggedAssetNames).toEqual(['USDA', 'USDA (192)'])
		expect(cache.pieAssets).toEqual([
			{ symbol: 'USDA', mcap: 40 },
			{ symbol: 'USDA (192)', mcap: 85 }
		])
		expect(cache.chartDataByPeggedAsset.map((history) => history[0].mcap.peggedUSD)).toEqual([40, 85])
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
