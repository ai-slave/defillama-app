import { describe, expect, it } from 'vitest'
import type { StablecoinChartResponse, StablecoinsListResponse } from '~/containers/Stablecoins/api.types'
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
		priceData: [],
		rateData: [],
		chain: 'All'
	})
}

describe('buildStablecoinsChartCacheValue', () => {
	it('maps chart-response double-count IDs to asset indexes', () => {
		const result = build(chartData)

		expect(result.doublecountedIds).toEqual([0])
		expect(result.chartDataByPeggedAsset[0]).toEqual([{ date: 1, mcap: { peggedUSD: 10 } }])
	})

	it('does not exclude assets when the response omits double-count metadata', () => {
		expect(build({ ...chartData, doublecountedIds: undefined }).doublecountedIds).toEqual([])
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
})
