import { describe, expect, it } from 'vitest'
import type { StablecoinChartResponse, StablecoinsListResponse } from '~/containers/Stablecoins/api.types'
import { buildStablecoinsChartCacheValue } from './stablecoinFetchers'

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
})
