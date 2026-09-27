import { describe, expect, test } from 'vitest'
import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	buildAreaPayload,
	buildDominancePayload,
	buildStablecoinMcapSummary,
	buildStablecoinOverviewPayload,
	buildTotalMcapPayload,
	groupStablecoinBarChartPayload,
	getStablecoinRuntimeSeries,
	type StablecoinChartSeriesPayload,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT
} from '../chartSeries'
import {
	buildStablecoinAggregatePairs,
	formatPeggedChainsData,
	getStablecoinValueFromPoint,
	type IBuildStablecoinChartDataParams
} from '../utils'

// Token inflows reach users through the overview payload; the top token only feeds the summary.
const summaryTopToken = { symbol: 'USDT', mcap: 150 }

function datasetValue(dataset: MultiSeriesTimeSeriesDataset, rowIndex: number, dimension: string) {
	return dataset.source[rowIndex]?.[dataset.dimensions.indexOf(dimension)]
}

const chartDataByAssetOrChain = [
	[
		{ date: 1_609_459_200, mcap: { peggedUSD: 100 }, unreleased: { peggedUSD: 10 } },
		{ date: 1_609_545_600, mcap: { peggedUSD: 125 }, unreleased: { peggedUSD: 10 } },
		{ date: 1_609_632_000, mcap: { peggedUSD: 150 }, unreleased: { peggedUSD: 10 } }
	],
	[
		{ date: 1_609_459_200, mcap: { peggedUSD: 50 }, unreleased: { peggedUSD: 5 } },
		{ date: 1_609_545_600, mcap: { peggedUSD: 60 }, unreleased: { peggedUSD: 5 } },
		{ date: 1_609_632_000, mcap: { peggedUSD: 90 }, unreleased: { peggedUSD: 5 } }
	]
]

const params = {
	chartDataByAssetOrChain,
	assetsOrChainsList: ['USDT', 'USDC'],
	filteredIndexes: [0, 1],
	issuanceType: 'mcap',
	selectedChain: 'All'
} satisfies IBuildStablecoinChartDataParams

const circulatingParams = {
	chartDataByAssetOrChain: [
		[
			{ date: 1_660_000_000, circulating: { peggedUSD: 100 }, unreleased: { peggedUSD: 10 } },
			{ date: 1_660_086_400, circulating: { peggedUSD: 125 }, unreleased: { peggedUSD: 15 } }
		],
		[
			{ date: 1_660_000_000, circulating: { peggedUSD: 50 }, unreleased: { peggedUSD: 5 } },
			{ date: 1_660_086_400, circulating: { peggedUSD: 60 }, unreleased: { peggedUSD: 10 } }
		]
	],
	assetsOrChainsList: ['Ethereum', 'Tron'],
	filteredIndexes: [0, 1],
	issuanceType: 'circulating',
	totalChartTooltipLabel: 'Circulating'
} satisfies IBuildStablecoinChartDataParams

describe('stablecoin chart series builders', () => {
	test('uses canonical availability while keeping aggregate helpers always visible', () => {
		expect(
			getStablecoinRuntimeSeries({
				charts: [
					{ type: 'line', name: 'USDT', encode: { x: 0, y: 1 } },
					{ type: 'line', name: 'USDC', encode: { x: 0, y: 2 } },
					{ type: 'line', name: 'Others', encode: { x: 0, y: 3 } },
					{ type: 'line', name: 'Total', encode: { x: 0, y: 4 } }
				],
				availableSeries: ['USDT', 'USDC', 'DAI'],
				defaultSeries: ['USDT', 'USDC']
			})
		).toEqual({
			selectableSeries: ['USDT', 'USDC', 'DAI'],
			defaultSeries: ['USDT', 'USDC'],
			renderedSelectableSeries: ['USDT', 'USDC'],
			fixedRemainderSeries: ['Others'],
			alwaysVisibleSeries: ['Total']
		})
	})

	test('separates a fixed remainder from configured volume series without availability metadata', () => {
		expect(
			getStablecoinRuntimeSeries({
				charts: [
					{ type: 'line', name: 'USDT', encode: { x: 0, y: 1 } },
					{ type: 'line', name: 'USDC', encode: { x: 0, y: 2 } },
					{ type: 'line', name: 'Others', encode: { x: 0, y: 3 } }
				]
			})
		).toEqual({
			selectableSeries: ['USDT', 'USDC'],
			defaultSeries: ['USDT', 'USDC'],
			renderedSelectableSeries: ['USDT', 'USDC'],
			fixedRemainderSeries: ['Others'],
			alwaysVisibleSeries: []
		})
	})

	test('builds each overview chart from its own rows and adds the shared summary', () => {
		const topToken = { symbol: 'USDT', mcap: 150 }
		const lastRows = {
			tokenMcaps: [1_609_632_000_000, 150, 90],
			dominance: [1_609_632_000_000, 62.5, 37.5],
			usdInflows: [1_609_545_600_000, 55],
			tokenInflows: [1_609_545_600_000, 25, 30]
		}

		for (const chart of ['tokenMcaps', 'dominance', 'usdInflows', 'tokenInflows'] as const) {
			const payload = buildStablecoinOverviewPayload(params, chart, topToken)
			expect(payload.dataset.source.at(-1)).toEqual(lastRows[chart])
			expect(payload.summary).toEqual({
				totalMcapCurrent: 240,
				change1d: null,
				change7d: null,
				change30d: null,
				change1dUsd: null,
				change7dUsd: null,
				change30dUsd: null,
				topToken,
				dominance: '62.50',
				dataTimestamp: 1_609_632_000,
				isDataStale: true
			})
		}
	})

	test('constructs an explicit stablecoin subset without a synthetic remainder', () => {
		const point = (date: number, value: number) => ({ date, mcap: { peggedUSD: value } })
		const selectionParams = {
			chartDataByAssetOrChain: [
				[point(1_660_000_000, 100), point(1_660_086_400, 125)],
				[point(1_660_000_000, 50), point(1_660_086_400, 75)]
			],
			assetsOrChainsList: ['USDT', 'USDC'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		} satisfies IBuildStablecoinChartDataParams
		const topToken = { symbol: 'USDT', mcap: 125 }
		expect(
			buildStablecoinOverviewPayload(selectionParams, 'tokenMcaps', topToken, {
				selectedNames: ['USDT']
			}).dataset.source
		).toEqual([
			[1_660_000_000_000, 100],
			[1_660_086_400_000, 125]
		])
		expect(
			buildStablecoinOverviewPayload(selectionParams, 'tokenMcaps', topToken, {
				selectedNames: ['USDC']
			}).dataset.source
		).toEqual([
			[1_660_000_000_000, 50],
			[1_660_086_400_000, 75]
		])
	})

	test('a pick list that names no stablecoin in the data shows the default series', () => {
		const point = (date: number, value: number) => ({ date, mcap: { peggedUSD: value } })
		const euroParams = {
			chartDataByAssetOrChain: [
				[point(1_660_000_000, 100), point(1_660_086_400, 125)],
				[point(1_660_000_000, 50), point(1_660_086_400, 75)]
			],
			assetsOrChainsList: ['EURC', 'EURS'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		} satisfies IBuildStablecoinChartDataParams
		const payload = buildStablecoinOverviewPayload(
			euroParams,
			'tokenMcaps',
			{ symbol: 'EURC', mcap: 125 },
			{
				selectedNames: ['USDT']
			}
		)
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'EURC', 'EURS'])
		expect(payload.dataset.source).toEqual([
			[1_660_000_000_000, 100, 50],
			[1_660_086_400_000, 125, 75]
		])
	})

	test('an exclusion that leaves no stablecoin in the data shows the default series', () => {
		const point = (date: number, value: number) => ({ date, mcap: { peggedUSD: value } })
		const onlyUsdt = {
			chartDataByAssetOrChain: [[point(1_660_000_000, 100)]],
			assetsOrChainsList: ['USDT'],
			filteredIndexes: [0],
			issuanceType: 'mcap',
			selectedChain: 'All'
		} satisfies IBuildStablecoinChartDataParams
		const payload = buildStablecoinOverviewPayload(
			onlyUsdt,
			'tokenMcaps',
			{ symbol: 'USDT', mcap: 100 },
			{ excludedNames: ['USDT'] }
		)
		expect(payload.dataset).toEqual({ dimensions: ['timestamp', 'USDT'], source: [[1_660_000_000_000, 100]] })
	})

	test('keeps total market cap ordering, currency totals, and missing values exact', () => {
		const mixedCurrencyParams = {
			chartDataByAssetOrChain: [
				[
					{ date: 1_609_459_200, mcap: { peggedUSD: 10, peggedEUR: 2 } },
					{ date: 1_609_545_600 },
					{ date: 1_609_632_000, mcap: { peggedUSD: 30, peggedEUR: 5 } }
				],
				[
					{ date: 1_609_459_200, mcap: { peggedUSD: 3 } },
					{ date: 1_609_545_600, mcap: { peggedUSD: 4 } },
					{ date: 1_609_632_000, mcap: { peggedUSD: 5 } }
				]
			],
			assetsOrChainsList: ['EUR Stable', 'USD Stable'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		} satisfies IBuildStablecoinChartDataParams
		const payload = buildTotalMcapPayload(mixedCurrencyParams)

		expect(payload.dataset.source).toEqual([
			[1_609_459_200_000, 15],
			[1_609_545_600_000, 4],
			[1_609_632_000_000, 40]
		])
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'Mcap'])
	})

	test('derives the summary top token from the latest chronological row', () => {
		const summary = buildStablecoinMcapSummary({
			chartDataByAssetOrChain: [
				[{ date: 1_660_000_000, mcap: { peggedUSD: 1000 } }],
				[{ date: 1_660_086_400, mcap: { peggedUSD: 10 } }]
			],
			assetsOrChainsList: ['Stale Large', 'Current Small'],
			issuanceType: 'mcap',
			selectedChain: 'All'
		})

		expect(summary.topToken).toEqual({ symbol: 'Current Small', mcap: 10 })
		expect(summary.mcapStats.totalMcapCurrent).toBe(10)
	})

	test('adds unreleased values to total circulating payloads when requested', () => {
		const payload = buildTotalMcapPayload(circulatingParams, {
			totalName: 'Circulating',
			includeUnreleased: true
		})

		expect(payload.dataset.source).toEqual([
			[1_660_000_000_000, 165],
			[1_660_086_400_000, 210]
		])
		expect(payload.valueSymbol).toBe('')
		expect(JSON.parse(JSON.stringify(payload)).valueSymbol).toBe('')
	})

	test('adds unreleased values before dominance normalization', () => {
		const payload = buildDominancePayload(circulatingParams, {
			includeUnreleased: true
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'Ethereum', 'Tron'])
		expect(payload.dataset.source).toEqual([
			[1_660_000_000_000, 66.67, 33.33],
			[1_660_086_400_000, 66.67, 33.33]
		])
	})

	test('keeps area rows sparse when a visible series has no value for a timestamp', () => {
		const sparseAreaParams = {
			chartDataByAssetOrChain: [
				[
					{ date: 1_609_459_200, mcap: { peggedUSD: 10 } },
					{ date: 1_609_545_600, mcap: { peggedUSD: 20 } }
				],
				[{ date: 1_609_545_600, mcap: { peggedUSD: 5 } }]
			],
			assetsOrChainsList: ['USDT', 'USDC'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		} satisfies IBuildStablecoinChartDataParams
		const payload = buildAreaPayload(sparseAreaParams, { stackName: 'tokenMcaps' })

		expect(payload.dataset.source).toEqual([
			[1_609_459_200_000, 10, undefined],
			[1_609_545_600_000, 20, 5]
		])
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'USDT', 'USDC'])
	})

	test('keeps double-counted assets selectable while excluding them from aggregate totals', () => {
		const firstDay = 1_700_000_000
		const secondDay = firstDay + 86_400
		const doublecountedParams = {
			chartDataByAssetOrChain: [
				[
					{ date: firstDay, mcap: { peggedUSD: 100 } },
					{ date: secondDay, mcap: { peggedUSD: 110 } }
				],
				[
					{ date: firstDay, mcap: { peggedUSD: 40 } },
					{ date: secondDay, mcap: { peggedUSD: 50 } }
				],
				[
					{ date: firstDay, mcap: { peggedUSD: 10 } },
					{ date: secondDay, mcap: { peggedUSD: 20 } }
				]
			],
			assetsOrChainsList: ['Base', 'Double', 'Other'],
			doublecountedIds: [1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		} satisfies IBuildStablecoinChartDataParams

		expect(buildTotalMcapPayload(doublecountedParams).dataset.source).toEqual([
			[firstDay * 1e3, 110],
			[secondDay * 1e3, 130]
		])
		const breakdown = buildAreaPayload(doublecountedParams, { stackName: 'tokens', seriesLimit: 1 })
		expect(breakdown.availableSeries).toEqual(['Base', 'Double', 'Other'])
		expect(breakdown.defaultSeries).toEqual(['Base', 'Other'])
		expect(datasetValue(breakdown.dataset, 1, 'Others')).toBe(20)
		const selectedAll = buildAreaPayload(doublecountedParams, {
			stackName: 'tokens',
			selectedNames: ['Base', 'Double', 'Other'],
			seriesLimit: 1
		})
		expect(datasetValue(selectedAll.dataset, 1, 'Others')).toBe(20)
		const selectedDouble = buildAreaPayload(doublecountedParams, {
			stackName: 'tokens',
			selectedNames: ['Double'],
			seriesLimit: 1
		})
		expect(selectedDouble.dataset.source).toEqual([
			[firstDay * 1e3, 40],
			[secondDay * 1e3, 50]
		])
		const selectedDoubleByExclusion = buildAreaPayload(doublecountedParams, {
			stackName: 'tokens',
			excludedNames: ['Other'],
			seriesLimit: 2
		})
		expect(selectedDoubleByExclusion.dataset.dimensions).toEqual(['timestamp', 'Base', 'Double'])
		const selectedAllByExclusion = buildAreaPayload(doublecountedParams, {
			stackName: 'tokens',
			excludedNames: [],
			seriesLimit: 3
		})
		expect(selectedAllByExclusion.dataset.dimensions).toEqual(['timestamp', 'Base', 'Double', 'Other'])

		const dominance = buildDominancePayload(doublecountedParams, { seriesLimit: 1 })
		expect(dominance.defaultSeries).toEqual(['Base', 'Other'])
		expect(datasetValue(dominance.dataset, 1, 'Others')).toBeCloseTo(15.38)
		// A double-counted asset has no share of the aggregate market, so dominance does not offer it.
		expect(dominance.availableSeries).toEqual(['Base', 'Other'])

		const inflows = buildStablecoinOverviewPayload(doublecountedParams, 'tokenInflows', summaryTopToken, {
			seriesLimit: 1
		})
		expect(inflows.defaultSeries).toEqual(['Base', 'Other'])
		expect(datasetValue(inflows.dataset, 0, 'Others')).toBe(10)
		const selectedDoubleInflows = buildStablecoinOverviewPayload(doublecountedParams, 'tokenInflows', summaryTopToken, {
			selectedNames: ['Double'],
			seriesLimit: 1
		})
		expect(selectedDoubleInflows.dataset.source).toEqual([[firstDay * 1e3, 10]])
	})

	test('subtracts double-counted assets from every USD peg bucket', () => {
		expect(
			buildStablecoinAggregatePairs({
				aggregated: [
					{ date: '1', totalCirculatingUSD: { peggedUSD: 100, peggedEUR: 30 } },
					{ date: '2', totalCirculatingUSD: { peggedUSD: 120, peggedEUR: 40 } }
				],
				breakdown: {
					double: [
						{ date: '1', totalCirculatingUSD: { peggedUSD: 10, peggedEUR: 5 } },
						{ date: '2', totalCirculatingUSD: { peggedUSD: 20, peggedEUR: 5 } }
					]
				},
				doublecountedIds: ['double']
			})
		).toEqual([
			[1, 115],
			[2, 135]
		])
	})

	test('distinguishes absent points, explicit nulls, and producer-pruned zeros', () => {
		expect(getStablecoinValueFromPoint(null, 'circulating')).toBeNull()
		expect(getStablecoinValueFromPoint({ date: 1 }, 'circulating')).toBe(0)
		expect(getStablecoinValueFromPoint({ date: 1, circulating: { peggedUSD: null } }, 'circulating')).toBeNull()
		expect(getStablecoinValueFromPoint({ date: 1, circulating: {} }, 'circulating')).toBe(0)
		expect(
			getStablecoinValueFromPoint(
				{ date: 1, bridgedTo: { bridges: { celer: { source: 'Ethereum' } } } },
				'bridgedTo',
				'peggedUSD'
			)
		).toBe(0)
	})

	test('does not read the next packed series after an area series ends', () => {
		const sparseEndingParams = {
			chartDataByAssetOrChain: [[{ date: 1_660_000_000, circulating: 10 }], [{ date: 1_660_086_400, circulating: 20 }]],
			assetsOrChainsList: ['Ended', 'Current'],
			issuanceType: 'circulating'
		} satisfies IBuildStablecoinChartDataParams

		expect(buildAreaPayload(sparseEndingParams, { stackName: 'chains' }).dataset.source).toEqual([
			[1_660_000_000_000, 10, undefined],
			[1_660_086_400_000, undefined, 20]
		])
		expect(buildDominancePayload(sparseEndingParams).dataset.source).toEqual([
			[1_660_000_000_000, 100, 0],
			[1_660_086_400_000, 0, 100]
		])
	})

	test('uses only producer-supplied tail points and does not invent inflows', () => {
		const stalePoint = { date: 1_660_000_000, mcap: { peggedUSD: 10 } }
		const currentSeries = [
			{ date: 1_660_000_000, mcap: { peggedUSD: 20 } },
			{ date: 1_660_086_400, mcap: { peggedUSD: 25 } },
			{ date: 1_660_172_800, mcap: { peggedUSD: 30 } }
		]
		const baseParams = {
			assetsOrChainsList: ['Stale', 'Current'],
			issuanceType: 'mcap' as const,
			selectedChain: 'All'
		}
		const producerData = { ...baseParams, chartDataByAssetOrChain: [[stalePoint], currentSeries] }

		expect(buildTotalMcapPayload(producerData).dataset.source).toEqual([
			[1_660_000_000_000, 30],
			[1_660_086_400_000, 25],
			[1_660_172_800_000, 30]
		])
		expect(buildAreaPayload(producerData, { stackName: 'tokens' }).dataset.source).toEqual([
			[1_660_000_000_000, 10, 20],
			[1_660_086_400_000, undefined, 25],
			[1_660_172_800_000, undefined, 30]
		])
		const inflows = buildStablecoinOverviewPayload(producerData, 'tokenInflows', summaryTopToken)
		expect(inflows.dataset.dimensions).toEqual(['timestamp', 'Current'])
		expect(inflows.dataset.source).toEqual([
			[1_660_000_000_000, 5],
			[1_660_086_400_000, 5]
		])
		expect(producerData.chartDataByAssetOrChain.map((series) => series.length)).toEqual([1, 3])
	})

	test('does not publish a partial value when included unreleased supply is unavailable', () => {
		const payload = buildTotalMcapPayload(
			{
				chartDataByAssetOrChain: [
					[
						{ date: 1_660_000_000, circulating: { peggedUSD: 100 }, unreleased: { peggedUSD: null } },
						{ date: 1_660_086_400, circulating: { peggedUSD: 110 }, unreleased: { peggedUSD: 5 } }
					]
				],
				assetsOrChainsList: ['Ethereum'],
				issuanceType: 'circulating'
			},
			{ totalName: 'Circulating', includeUnreleased: true }
		)

		expect(payload.dataset.source).toEqual([[1_660_086_400_000, 115]])
	})

	test('keeps token inflow series within their different ending calendars', () => {
		const tokenInflows = buildStablecoinOverviewPayload(
			{
				chartDataByAssetOrChain: [
					[
						{ date: 1_660_000_000, mcap: { peggedUSD: 10 } },
						{ date: 1_660_086_400, mcap: { peggedUSD: 15 } }
					],
					[
						{ date: 1_660_086_400, mcap: { peggedUSD: 20 } },
						{ date: 1_660_172_800, mcap: { peggedUSD: 12 } }
					]
				],
				assetsOrChainsList: ['Ended', 'Current'],
				issuanceType: 'mcap',
				selectedChain: 'All'
			},
			'tokenInflows',
			summaryTopToken
		)

		expect(tokenInflows.dataset.source).toEqual([
			[1_660_000_000_000, 5, undefined],
			[1_660_086_400_000, undefined, -8]
		])
	})

	test('builds dominance rows as shares of the day total', () => {
		const payload = buildDominancePayload(params)

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'USDT', 'USDC'])
		expect(payload.dataset.source.at(-1)).toEqual([1_609_632_000_000, 62.5, 37.5])
	})

	test('preserves dense asset rows and exactly normalized dominance', () => {
		const assetParams = {
			chartDataByAssetOrChain: [
				[{ date: 1_660_000_000, circulating: 1 }],
				[{ date: 1_660_000_000, circulating: 1 }],
				[
					{ date: 1_659_913_600, circulating: 2 },
					{ date: 1_660_000_000, circulating: 1 }
				]
			],
			assetsOrChainsList: ['A', 'B', 'C'],
			issuanceType: 'circulating'
		} satisfies IBuildStablecoinChartDataParams
		const area = buildAreaPayload(assetParams, { stackName: 'chains', fillMissingValues: true })
		const dominance = buildDominancePayload(assetParams)

		expect(area.dataset.source[0]).toEqual([1_659_913_600_000, 0, 0, 2])
		const row = dominance.dataset.source.at(-1)
		expect((row?.[1] ?? 0) + (row?.[2] ?? 0) + (row?.[3] ?? 0)).toBe(100)
	})

	test('draws cumulative token inflows as stacked lines', () => {
		const payload = buildStablecoinOverviewPayload(params, 'tokenInflows', summaryTopToken)

		const cumulative = groupStablecoinBarChartPayload(payload, 'cumulative')
		expect(cumulative.charts.every((chart) => chart.type === 'line' && chart.stack === 'tokenInflows')).toBe(true)
		expect(cumulative.charts.every((chart) => chart.large == null)).toBe(true)
	})

	test('bounds the initial breakdown and aggregates every omitted value into one exact Others series', () => {
		const names = [...Array(12)].map((_, index) => `Token${index + 1}`)
		names.push('Others')
		const largeParams = {
			chartDataByAssetOrChain: names.map((name, index) => {
				const value = name === 'Others' ? 5 : index + 1
				return [
					{ date: '1700000000', mcap: { peggedUSD: value } },
					{ date: '1700086400', mcap: { peggedUSD: value * 10 } }
				]
			}),
			assetsOrChainsList: names,
			issuanceType: 'mcap',
			selectedChain: 'All'
		} satisfies IBuildStablecoinChartDataParams

		const uncapped = buildAreaPayload(largeParams, { stackName: 'tokenMcaps' })
		expect(uncapped.charts).toHaveLength(names.length)
		expect(uncapped.dataset.dimensions).toEqual(['timestamp', ...names])

		const area = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		const renderedDefaultSeries = [
			'Token12',
			'Token11',
			'Token10',
			'Token9',
			'Token8',
			'Token7',
			'Token6',
			'Token5',
			'Token4',
			'Token3'
		]
		expect(area.defaultSeries).toEqual(names.slice(0, -1).reverse())
		expect(area.charts).toHaveLength(STABLECOIN_BREAKDOWN_SERIES_LIMIT + 1)
		expect(area.dataset.dimensions).toEqual(['timestamp', ...renderedDefaultSeries, 'Others'])
		expect(datasetValue(area.dataset, 0, 'Others')).toBe(8)
		expect(datasetValue(area.dataset, 1, 'Others')).toBe(80)

		const dominance = buildDominancePayload(largeParams, { seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT })
		expect(datasetValue(dominance.dataset, 1, 'Token12')).toBe(14.46)
		expect(datasetValue(dominance.dataset, 1, 'Others')).toBeCloseTo(9.65)
		expect(dominance.dataset.source[1]?.slice(1).reduce<number>((sum, value) => sum + (value ?? 0), 0)).toBe(100)
		const tokenInflows = buildStablecoinOverviewPayload(largeParams, 'tokenInflows', summaryTopToken, {
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(tokenInflows.defaultSeries).toEqual(names.slice(0, -1).reverse())
		expect(tokenInflows.charts).toHaveLength(STABLECOIN_BREAKDOWN_SERIES_LIMIT + 1)
		expect(datasetValue(tokenInflows.dataset, 0, 'Token12')).toBe(108)
		expect(datasetValue(tokenInflows.dataset, 0, 'Others')).toBe(72)

		const selected = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: ['Token1'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selected.dataset.dimensions).toEqual(['timestamp', 'Token1'])
		expect(selected.dataset.source.at(-1)).toEqual([1_700_086_400_000, 10])

		const selectedOverLimit = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: names.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT + 2),
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(datasetValue(selectedOverLimit.dataset, 1, 'Others')).toBe(30)

		const selectedSubsetOverLimit = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: names.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT + 1),
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(datasetValue(selectedSubsetOverLimit.dataset, 1, 'Others')).toBe(10)

		const allExceptLargest = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			excludedNames: ['Token12'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		// The source-level reserved Others remains part of an all-except selection.
		expect(datasetValue(allExceptLargest.dataset, 1, 'Others')).toBe(60)
		expect(allExceptLargest.dataset.dimensions).not.toContain('Token12')

		// Picked coins keep their share of the whole market; the rest of the market stays in Others.
		const selectedDominance = buildDominancePayload(largeParams, {
			selectedNames: ['Token1', 'Token2'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selectedDominance.charts.map((chart) => chart.name)).toEqual(['Token2', 'Token1', 'Others'])
		expect(selectedDominance.dataset.source[1]).toEqual([1_700_086_400_000, 2.41, 1.2, 96.39])

		const selectedPair = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: ['Token2', 'Token1'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selectedPair.charts.find((chart) => chart.name === 'Token1')?.color).toBe(selected.charts[0]?.color)

		const selectAll = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: names,
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selectAll.dataset.dimensions).toEqual([
			'timestamp',
			'Token12',
			'Token11',
			'Token10',
			'Token9',
			'Token8',
			'Token7',
			'Token6',
			'Token5',
			'Token4',
			'Token3',
			'Others'
		])
		expect(datasetValue(selectAll.dataset, 1, 'Token12')).toBe(120)
		expect(datasetValue(selectAll.dataset, 1, 'Token10')).toBe(100)
		expect(datasetValue(selectAll.dataset, 1, 'Others')).toBe(30)
	})

	test('keeps the rendered series count constant for a 400-series input', () => {
		const seriesNames = [...Array(400)].map((_, index) => `Token${index + 1}`)
		const payload = buildAreaPayload(
			{
				chartDataByAssetOrChain: seriesNames.map((_, index) => [
					{ date: '1700000000', mcap: { peggedUSD: index + 1 } }
				]),
				assetsOrChainsList: seriesNames,
				issuanceType: 'mcap',
				selectedChain: 'All'
			},
			{ stackName: 'tokenMcaps', seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT }
		)

		expect(payload.charts).toHaveLength(STABLECOIN_BREAKDOWN_SERIES_LIMIT + 1)
		expect(payload.dataset.dimensions).toHaveLength(STABLECOIN_BREAKDOWN_SERIES_LIMIT + 2)
		expect(datasetValue(payload.dataset, 0, 'Token400')).toBe(400)
		expect(datasetValue(payload.dataset, 0, 'Others')).toBe(76_245)
	})

	test('groups stablecoin inflow bar payloads by the selected interval', () => {
		const payload: StablecoinChartSeriesPayload = {
			dataset: {
				dimensions: ['timestamp', 'Inflows'],
				source: [
					[Date.UTC(2024, 0, 3), 100],
					[Date.UTC(2024, 0, 20), -25],
					[Date.UTC(2024, 1, 1), 50]
				]
			},
			charts: [{ type: 'bar', name: 'Inflows', encode: { x: 'timestamp', y: 'Inflows' } }],
			valueSymbol: '$',
			stacked: false,
			showTotalInTooltip: false
		}

		expect(groupStablecoinBarChartPayload(payload, 'monthly')).toEqual({
			...payload,
			dataset: {
				dimensions: ['timestamp', 'Inflows'],
				source: [
					[Date.UTC(2024, 0, 1), 75],
					[Date.UTC(2024, 1, 1), 50]
				]
			}
		})
		expect(groupStablecoinBarChartPayload(payload, 'cumulative')).toEqual({
			...payload,
			charts: [{ type: 'line', name: 'Inflows', encode: { x: 'timestamp', y: 'Inflows' } }],
			dataset: {
				dimensions: ['timestamp', 'Inflows'],
				source: [
					[Date.UTC(2024, 0, 3), 100],
					[Date.UTC(2024, 0, 20), 75],
					[Date.UTC(2024, 1, 1), 125]
				]
			}
		})
		expect(groupStablecoinBarChartPayload(payload, 'daily')).toBe(payload)
	})
})

describe('stablecoin table data formatters', () => {
	test('keeps chain rows sorted with exact null and dominance values', () => {
		const result = formatPeggedChainsData({
			currentTimeMs: Date.parse('2021-01-02T12:00:00Z'),
			chainList: ['Small', 'Big', 'Empty'],
			peggedChartDataByChain: [
				[
					{
						date: '1609459200',
						totalCirculatingUSD: { peggedUSD: 100 },
						totalCirculating: { peggedUSD: 80 },
						totalUnreleased: { peggedUSD: 20 },
						totalBridgedToUSD: { peggedUSD: 5 },
						totalMintedUSD: { peggedUSD: 95 }
					},
					{
						date: '1609545600',
						totalCirculatingUSD: { peggedUSD: 110 },
						totalCirculating: { peggedUSD: 90 },
						totalUnreleased: { peggedUSD: 20 },
						totalBridgedToUSD: { peggedUSD: 6 },
						totalMintedUSD: { peggedUSD: 104 }
					}
				],
				[
					{
						date: '1609459200',
						totalCirculatingUSD: { peggedUSD: 200 },
						totalCirculating: { peggedUSD: 160 },
						totalUnreleased: { peggedUSD: 40 },
						totalBridgedToUSD: { peggedUSD: 7 },
						totalMintedUSD: { peggedUSD: 193 }
					},
					{
						date: '1609545600',
						totalCirculatingUSD: { peggedUSD: 220 },
						totalCirculating: { peggedUSD: 180 },
						totalUnreleased: { peggedUSD: 40 },
						totalBridgedToUSD: { peggedUSD: 8 },
						totalMintedUSD: { peggedUSD: 212 }
					}
				],
				null
			],
			chainDominances: {
				Small: { symbol: 'USDC', mcap: 55 },
				Big: { symbol: 'USDT', mcap: 200 }
			}
		})

		expect(result).toEqual([
			{
				name: 'Big',
				circulating: 180,
				mcap: 220,
				unreleased: 40,
				bridgedTo: 8,
				minted: 212,
				mcapPrevDay: 200,
				mcapPrevWeek: null,
				mcapPrevMonth: null,
				change_1d: 10,
				change_7d: null,
				change_1m: null,
				dominance: { name: 'USDT', value: '90.91' }
			},
			{
				name: 'Small',
				circulating: 90,
				mcap: 110,
				unreleased: 20,
				bridgedTo: 6,
				minted: 104,
				mcapPrevDay: 100,
				mcapPrevWeek: null,
				mcapPrevMonth: null,
				change_1d: 10,
				change_7d: null,
				change_1m: null,
				dominance: { name: 'USDC', value: '50.00' }
			},
			{
				name: 'Empty',
				circulating: null,
				mcap: null,
				unreleased: null,
				bridgedTo: null,
				minted: null,
				mcapPrevDay: null,
				mcapPrevWeek: null,
				mcapPrevMonth: null,
				change_1d: null,
				change_7d: null,
				change_1m: null,
				dominance: null
			}
		])
	})
})
