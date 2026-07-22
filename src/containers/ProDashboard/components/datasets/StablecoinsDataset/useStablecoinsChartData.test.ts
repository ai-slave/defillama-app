import { describe, expect, it } from 'vitest'
import {
	getTopStablecoinFromLatestPoints,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT
} from '~/containers/Stablecoins/chartSeries'
import {
	buildProStablecoinChartPresentationFromCollection,
	buildProStablecoinOverviewPayload,
	collectProStablecoinChart
} from './useStablecoinsChartData'

const assetNames = Array.from({ length: STABLECOIN_BREAKDOWN_SERIES_LIMIT + 2 }, (_, index) => `TOKEN_${index}`)
const params = {
	chartDataByAssetOrChain: assetNames.map((_, index) => [
		{ date: 1_600_000_000, mcap: { peggedUSD: 100 - index } },
		{ date: 1_600_086_400, mcap: { peggedUSD: 200 - index } }
	]),
	assetsOrChainsList: assetNames,
	filteredIndexes: assetNames.map((_, index) => index),
	issuanceType: 'mcap' as const,
	selectedChain: 'All'
}
const topToken = getTopStablecoinFromLatestPoints(params)

describe('buildProStablecoinOverviewPayload', () => {
	it('bounds the default null selection and aggregates the remaining assets', () => {
		const result = buildProStablecoinOverviewPayload(params, 'tokenMcaps', topToken, null)

		expect(result.defaultSeries).toEqual(assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT))
		expect(result.charts.map((chart) => chart.name)).toEqual([
			...assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT),
			'Others'
		])
		expect(result.dataset.source.at(-1)?.[result.dataset.dimensions.indexOf('Others')]).toBe(379)
	})

	it('keeps an explicit asset outside the default top set selectable', () => {
		const selectedName = assetNames.at(-1)!
		const result = buildProStablecoinOverviewPayload(params, 'tokenMcaps', topToken, [selectedName])

		expect(result.availableSeries).toContain(selectedName)
		expect(result.defaultSeries).toEqual(assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT))
		expect(result.charts.map((chart) => chart.name)).toEqual([selectedName, 'Others'])
		expect(result.dataset.source.at(-1)?.[result.dataset.dimensions.indexOf(selectedName)]).toBe(189)
		expect(result.dataset.source.at(-1)?.[result.dataset.dimensions.indexOf('Others')]).toBe(2_145)
	})

	it('reuses the canonical history when the token selection changes', () => {
		let reads = 0
		const point = (date: number, value: number) => ({
			date,
			get mcap() {
				reads++
				return { peggedUSD: value }
			}
		})
		const rawData = {
			chartDataByPeggedAsset: [
				[point(1_660_000_000, 100), point(1_660_086_400, 125)],
				[point(1_660_000_000, 50), point(1_660_086_400, 75)]
			],
			peggedAssetNames: ['USDT', 'USDC'],
			peggedAssetIdToChartDataIndex: { usdt: 0, usdc: 1 },
			doublecountedIds: [],
			pieAssets: []
		}

		const collection = collectProStablecoinChart({ rawData, chain: 'All', chartType: 'tokenMcaps' })
		expect(reads).toBe(4)

		const usdt = buildProStablecoinChartPresentationFromCollection(collection, ['USDT'])
		const usdc = buildProStablecoinChartPresentationFromCollection(collection, ['USDC'])

		expect(reads).toBe(4)
		expect(usdt.chartPayload.dataset).toEqual({
			dimensions: ['timestamp', 'USDT', 'Others'],
			source: [
				[1_660_000_000_000, 100, 50],
				[1_660_086_400_000, 125, 75]
			]
		})
		expect(usdc.chartPayload.dataset).toEqual({
			dimensions: ['timestamp', 'USDC', 'Others'],
			source: [
				[1_660_000_000_000, 50, 100],
				[1_660_086_400_000, 75, 125]
			]
		})
	})

	it('constructs the Pro USD inflow label without projecting the positional rows', () => {
		const result = buildProStablecoinOverviewPayload(params, 'usdInflows', topToken, null)

		expect(result.dataset.dimensions).toEqual(['timestamp', 'USD Inflows'])
		expect(result.charts).toMatchObject([{ name: 'USD Inflows', encode: { x: 0, y: 1 } }])
		expect(result.dataset.source).toEqual([[1600000000000, 1_200]])
	})
})
