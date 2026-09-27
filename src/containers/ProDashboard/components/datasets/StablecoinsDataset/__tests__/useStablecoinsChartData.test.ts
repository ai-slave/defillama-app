import { describe, expect, test } from 'vitest'
import { resolveLocalSelection } from '~/components/Select/localSelection'
import {
	getTopStablecoinFromLatestPoints,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT
} from '~/containers/Stablecoins/chartSeries'
import {
	buildProStablecoinCsvDataset,
	buildProStablecoinChartPresentationFromCollection,
	buildProStablecoinOverviewPayload,
	collectProStablecoinChart
} from '../useStablecoinsChartData'

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
	test('bounds the default null selection and aggregates the remaining assets', () => {
		const result = buildProStablecoinOverviewPayload(params, 'tokenMcaps', topToken, null)

		expect(result.defaultSeries).toEqual(assetNames)
		expect(result.charts.map((chart) => chart.name)).toEqual([
			...assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT),
			'Others'
		])
		expect(result.dataset.source.at(-1)?.[result.dataset.dimensions.indexOf('Others')]).toBe(379)
	})

	test('keeps every asset addressable without showing unselected peers as Others', () => {
		const selectedName = assetNames.at(-1)!
		const result = buildProStablecoinOverviewPayload(params, 'tokenMcaps', topToken, [selectedName])

		expect(result.availableSeries).toContain(selectedName)
		expect(result.defaultSeries).toEqual(assetNames)
		expect(result.charts.map((chart) => chart.name)).toEqual([selectedName])
		expect(result.dataset.source.at(-1)?.[result.dataset.dimensions.indexOf(selectedName)]).toBe(189)
		expect(result.dataset.dimensions).not.toContain('Others')
	})

	test('keeps the canonical collection while projecting only the bounded default', () => {
		const collection = collectProStablecoinChart({
			rawData: {
				chartDataByPeggedAsset: params.chartDataByAssetOrChain,
				peggedAssetNames: params.assetsOrChainsList,
				peggedAssetIdToChartDataIndex: {},
				doublecountedIds: [],
				pieAssets: []
			},
			chain: 'All',
			chartType: 'tokenMcaps'
		})
		const result = buildProStablecoinChartPresentationFromCollection(collection)

		expect(result.chartPayload.dataset.dimensions).toEqual([
			'timestamp',
			...assetNames.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT),
			'Others'
		])
		expect(result.chartPayload.defaultSeries).toEqual(assetNames)
		expect(result.chartPayload.dataset.source.at(-1)?.at(-1)).toBe(379)
		expect(result.chartPayload.charts.every((chart) => chart.stack == null)).toBe(true)
	})

	test('reuses the canonical history when the token selection changes', () => {
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

		const presentation = buildProStablecoinChartPresentationFromCollection(collection)
		const selectedPresentation = buildProStablecoinChartPresentationFromCollection(collection, {
			selectedNames: ['USDC']
		})
		const csvDataset = buildProStablecoinCsvDataset(collection, { selectedNames: ['USDC'] })

		expect(reads).toBe(4)
		expect(presentation.chartPayload.dataset).toEqual({
			dimensions: ['timestamp', 'USDT', 'USDC'],
			source: [
				[1_660_000_000_000, 100, 50],
				[1_660_086_400_000, 125, 75]
			]
		})
		expect(selectedPresentation.chartPayload.dataset).toEqual({
			dimensions: ['timestamp', 'USDC'],
			source: [
				[1_660_000_000_000, 50],
				[1_660_086_400_000, 75]
			]
		})
		expect(csvDataset).toEqual({
			dimensions: ['timestamp', 'USDC'],
			source: [
				[1_660_000_000_000, 50],
				[1_660_086_400_000, 75]
			]
		})
	})

	test('preserves one backend Others remainder when peers are below the series limit', () => {
		const rawData = {
			chartDataByPeggedAsset: [
				[{ date: 1_660_000_000, mcap: { peggedUSD: 100 } }],
				[{ date: 1_660_000_000, mcap: { peggedUSD: 50 } }],
				[{ date: 1_660_000_000, mcap: { peggedUSD: 25 } }]
			],
			peggedAssetNames: ['USDT', 'USDC', 'Others'],
			peggedAssetIdToChartDataIndex: { usdt: 0, usdc: 1 },
			doublecountedIds: [],
			pieAssets: []
		}
		const collection = collectProStablecoinChart({ rawData, chain: 'All', chartType: 'tokenMcaps' })
		const result = buildProStablecoinChartPresentationFromCollection(collection).chartPayload

		expect(result.availableSeries).toEqual(['USDT', 'USDC'])
		expect(result.dataset.dimensions).toEqual(['timestamp', 'USDT', 'USDC', 'Others'])
		expect(result.dataset.source).toEqual([[1_660_000_000_000, 100, 50, 25]])
		expect(result.charts.map((chart) => chart.name)).toEqual(['USDT', 'USDC', 'Others'])
	})

	test('constructs the Pro USD inflow label without projecting the positional rows', () => {
		const result = buildProStablecoinOverviewPayload(params, 'usdInflows', topToken, null)

		expect(result.dataset.dimensions).toEqual(['timestamp', 'USD Inflows'])
		expect(result.charts).toMatchObject([{ name: 'USD Inflows', encode: { x: 0, y: 1 } }])
		expect(result.dataset.source).toEqual([[1_600_000_000_000, 1200]])
	})

	test('keeps every pie token canonical until runtime presentation', () => {
		const pieAssets = Array.from({ length: 12 }, (_, index) => ({
			symbol: `TOKEN_${index}`,
			mcap: 12 - index,
			aggregateIncluded: index !== 1
		}))
		const result = buildProStablecoinChartPresentationFromCollection(
			collectProStablecoinChart({
				rawData: {
					chartDataByPeggedAsset: [],
					peggedAssetNames: [],
					peggedAssetIdToChartDataIndex: {},
					doublecountedIds: [],
					pieAssets
				},
				chain: 'All',
				chartType: 'pie'
			})
		)

		expect(result.pieSeries.peers).toHaveLength(12)
		expect(result.pieSeries.peers.at(-1)).toEqual({ name: 'TOKEN_11', value: 1 })
		expect(result.pieSeries.limit).toBe(10)
		expect(result.defaultSeries).toEqual(
			pieAssets.filter((asset) => asset.aggregateIncluded).map((asset) => asset.symbol)
		)
		expect(result.totalMcapCurrent).toBe(67)
	})

	test('keeps an all-double-counted pie empty by default but explicitly selectable', () => {
		const result = buildProStablecoinChartPresentationFromCollection(
			collectProStablecoinChart({
				rawData: {
					chartDataByPeggedAsset: [],
					peggedAssetNames: [],
					peggedAssetIdToChartDataIndex: {},
					doublecountedIds: [0],
					pieAssets: [{ symbol: 'DOUBLE', mcap: 10, aggregateIncluded: false }]
				},
				chain: 'All',
				chartType: 'pie'
			})
		)

		expect(result.defaultSeries).toEqual([])
		expect(result.totalMcapCurrent).toBeNull()
		expect(
			resolveLocalSelection({
				availableSeries: ['DOUBLE'],
				intent: null,
				defaultSeries: result.defaultSeries,
				allowEmptySelection: true
			})
		).toEqual([])
		expect(
			resolveLocalSelection({
				availableSeries: ['DOUBLE'],
				intent: { mode: 'include', names: ['DOUBLE'] },
				defaultSeries: result.defaultSeries,
				allowEmptySelection: true
			})
		).toEqual(['DOUBLE'])
	})
})
