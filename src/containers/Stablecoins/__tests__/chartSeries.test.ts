import { describe, expect, it } from 'vitest'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import {
	buildAreaPayload,
	buildDominancePayload,
	buildStablecoinMcapSummary,
	buildStablecoinOverviewPayload,
	buildTokenInflowsPayload,
	buildTotalMcapPayload,
	buildUsdInflowsPayload,
	groupStablecoinBarChartPayload,
	getStablecoinRuntimeSeries,
	type StablecoinChartSeriesPayload,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT
} from '../chartSeries'
import { formatPeggedChainsData } from '../utils'

function datasetValue(dataset: MultiSeriesChartDataset, rowIndex: number, dimension: string) {
	return dataset.source[rowIndex][dataset.dimensions.indexOf(dimension)]
}

const chartDataByAssetOrChain = [
	[
		{ date: 1609459200, mcap: { peggedUSD: 100 }, unreleased: { peggedUSD: 10 } },
		{ date: 1609545600, mcap: { peggedUSD: 125 }, unreleased: { peggedUSD: 10 } },
		{ date: 1609632000, mcap: { peggedUSD: 150 }, unreleased: { peggedUSD: 10 } }
	],
	[
		{ date: 1609459200, mcap: { peggedUSD: 50 }, unreleased: { peggedUSD: 5 } },
		{ date: 1609545600, mcap: { peggedUSD: 60 }, unreleased: { peggedUSD: 5 } },
		{ date: 1609632000, mcap: { peggedUSD: 90 }, unreleased: { peggedUSD: 5 } }
	]
]

const params = {
	chartDataByAssetOrChain,
	assetsOrChainsList: ['USDT', 'USDC'],
	filteredIndexes: [0, 1],
	issuanceType: 'mcap',
	selectedChain: 'All'
}

const circulatingParams = {
	chartDataByAssetOrChain: [
		[
			{ date: 1660000000, circulating: { peggedUSD: 100 }, unreleased: { peggedUSD: 10 } },
			{ date: 1660086400, circulating: { peggedUSD: 125 }, unreleased: { peggedUSD: 15 } }
		],
		[
			{ date: 1660000000, circulating: { peggedUSD: 50 }, unreleased: { peggedUSD: 5 } },
			{ date: 1660086400, circulating: { peggedUSD: 60 }, unreleased: { peggedUSD: 10 } }
		]
	],
	assetsOrChainsList: ['Ethereum', 'Tron'],
	filteredIndexes: [0, 1],
	issuanceType: 'circulating',
	totalChartTooltipLabel: 'Circulating'
}

describe('stablecoin chart series builders', () => {
	it('uses canonical availability while keeping aggregate helpers always visible', () => {
		expect(
			getStablecoinRuntimeSeries({
				charts: [
					{ type: 'line', name: 'USDT', encode: { x: 0, y: 1 } },
					{ type: 'line', name: 'USDC', encode: { x: 0, y: 2 } },
					{ type: 'line', name: 'Others', encode: { x: 0, y: 3 } }
				],
				availableSeries: ['USDT', 'USDC', 'DAI']
			})
		).toEqual({
			selectableSeries: ['USDT', 'USDC', 'DAI'],
			renderedSelectableSeries: ['USDT', 'USDC'],
			fixedRemainderSeries: ['Others'],
			alwaysVisibleSeries: []
		})
	})

	it('separates a fixed remainder from configured volume series without availability metadata', () => {
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
			renderedSelectableSeries: ['USDT', 'USDC'],
			fixedRemainderSeries: ['Others'],
			alwaysVisibleSeries: []
		})
	})

	it('keeps overview chart payloads identical while adding their shared summary', () => {
		const topToken = { symbol: 'USDT', mcap: 150 }
		const { mcapStats } = buildStablecoinMcapSummary(params)
		const summary = {
			totalMcapCurrent: mcapStats.totalMcapCurrent,
			change1d: mcapStats.change1d,
			change7d: mcapStats.change7d,
			change30d: mcapStats.change30d,
			change1dUsd: mcapStats.change1dUsd,
			change7dUsd: mcapStats.change7dUsd,
			change30dUsd: mcapStats.change30dUsd,
			topToken,
			dominance: '62.50',
			dataTimestamp: mcapStats.dataTimestamp,
			isDataStale: mcapStats.isDataStale
		}
		const expectedPayloads = {
			tokenMcaps: buildAreaPayload(params, { stackName: 'tokenMcaps' }),
			dominance: buildDominancePayload(params, { stackName: 'dominance' }),
			usdInflows: buildUsdInflowsPayload(params),
			tokenInflows: buildTokenInflowsPayload(params)
		}

		for (const chart of ['tokenMcaps', 'dominance', 'usdInflows', 'tokenInflows'] as const) {
			expect(buildStablecoinOverviewPayload(params, chart, topToken)).toEqual({
				...expectedPayloads[chart],
				summary
			})
		}
	})

	it('constructs an explicit stablecoin subset without a synthetic remainder', () => {
		const point = (date: number, value: number) => ({ date, mcap: { peggedUSD: value } })
		const selectionParams = {
			chartDataByAssetOrChain: [
				[point(1660000000, 100), point(1660086400, 125)],
				[point(1660000000, 50), point(1660086400, 75)]
			],
			assetsOrChainsList: ['USDT', 'USDC'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		}
		const topToken = { symbol: 'USDT', mcap: 125 }
		expect(
			buildStablecoinOverviewPayload(selectionParams, 'tokenMcaps', topToken, {
				selectedNames: ['USDT']
			}).dataset.source
		).toEqual([
			[1660000000000, 100],
			[1660086400000, 125]
		])
		expect(
			buildStablecoinOverviewPayload(selectionParams, 'tokenMcaps', topToken, {
				selectedNames: ['USDC']
			}).dataset.source
		).toEqual([
			[1660000000000, 50],
			[1660086400000, 75]
		])
	})

	it('keeps total market cap ordering, currency totals, and missing values exact', () => {
		const mixedCurrencyParams = {
			chartDataByAssetOrChain: [
				[
					{ date: 1609459200, mcap: { peggedUSD: 10, peggedEUR: 2 } },
					{ date: 1609545600 },
					{ date: 1609632000, mcap: { peggedUSD: 30, peggedEUR: 5 } }
				],
				[
					{ date: 1609459200, mcap: { peggedUSD: 3 } },
					{ date: 1609545600, mcap: { peggedUSD: 4 } },
					{ date: 1609632000, mcap: { peggedUSD: 5 } }
				]
			],
			assetsOrChainsList: ['EUR Stable', 'USD Stable'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		}
		const payload = buildTotalMcapPayload(mixedCurrencyParams)

		expect(payload.dataset.source).toEqual([
			[1609459200000, 15],
			[1609545600000, 4],
			[1609632000000, 40]
		])
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'Mcap'])
	})

	it('derives the summary top token from the latest chronological row', () => {
		const summary = buildStablecoinMcapSummary({
			chartDataByAssetOrChain: [
				[{ date: 1_660_000_000, mcap: { peggedUSD: 1_000 } }],
				[{ date: 1_660_086_400, mcap: { peggedUSD: 10 } }]
			],
			assetsOrChainsList: ['Stale Large', 'Current Small'],
			issuanceType: 'mcap',
			selectedChain: 'All'
		})

		expect(summary.topToken).toEqual({ symbol: 'Current Small', mcap: 10 })
		expect(summary.mcapStats.totalMcapCurrent).toBe(10)
	})

	it('parses string epoch dates before shaping mcap chart rows', () => {
		const stringDateParams = {
			chartDataByAssetOrChain: [
				[
					{ date: '1609459200', mcap: { peggedUSD: 10 } },
					{ date: '1609545600', mcap: { peggedUSD: 20 } }
				],
				[
					{ date: '1609459200', mcap: { peggedUSD: 5 } },
					{ date: '1609545600', mcap: { peggedUSD: 10 } }
				]
			],
			assetsOrChainsList: ['USDT', 'USDC'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		}

		expect(buildTotalMcapPayload(stringDateParams).dataset.source).toEqual([
			[1609459200000, 15],
			[1609545600000, 30]
		])
		expect(buildAreaPayload(stringDateParams, { stackName: 'tokenMcaps' }).dataset.source).toEqual([
			[1609459200000, 10, 5],
			[1609545600000, 20, 10]
		])
		expect(buildDominancePayload(stringDateParams).dataset.source).toEqual([
			[1609459200000, 66.67, 33.33],
			[1609545600000, 66.67, 33.33]
		])
	})

	it('adds unreleased values to total circulating payloads when requested', () => {
		const payload = buildTotalMcapPayload(circulatingParams, {
			totalName: 'Circulating',
			includeUnreleased: true
		})

		expect(payload.dataset.source).toEqual([
			[1660000000000, 165],
			[1660086400000, 210]
		])
		expect(payload.valueSymbol).toBe('')
		expect(JSON.parse(JSON.stringify(payload)).valueSymbol).toBe('')
	})

	it('adds unreleased values before dominance normalization', () => {
		const payload = buildDominancePayload(circulatingParams, {
			includeUnreleased: true
		})

		expect(payload.dataset.dimensions).toEqual(['timestamp', 'Ethereum', 'Tron'])
		expect(payload.dataset.source).toEqual([
			[1660000000000, 66.67, 33.33],
			[1660086400000, 66.67, 33.33]
		])
	})

	it('keeps area rows sparse when a visible series has no value for a timestamp', () => {
		const sparseAreaParams = {
			chartDataByAssetOrChain: [
				[
					{ date: 1609459200, mcap: { peggedUSD: 10 } },
					{ date: 1609545600, mcap: { peggedUSD: 20 } }
				],
				[{ date: 1609545600, mcap: { peggedUSD: 5 } }]
			],
			assetsOrChainsList: ['USDT', 'USDC'],
			filteredIndexes: [0, 1],
			issuanceType: 'mcap',
			selectedChain: 'All'
		}
		const payload = buildAreaPayload(sparseAreaParams, { stackName: 'tokenMcaps' })

		expect(payload.dataset.source).toEqual([
			[1609459200000, 10, undefined],
			[1609545600000, 20, 5]
		])
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'USDT', 'USDC'])
	})

	it('does not read the next packed series after an area series ends', () => {
		const sparseEndingParams = {
			chartDataByAssetOrChain: [[{ date: 1660000000, circulating: 10 }], [{ date: 1660086400, circulating: 20 }]],
			assetsOrChainsList: ['Ended', 'Current'],
			issuanceType: 'circulating'
		}

		expect(buildAreaPayload(sparseEndingParams, { stackName: 'chains' }).dataset.source).toEqual([
			[1660000000000, 10, undefined],
			[1660086400000, undefined, 20]
		])
		expect(buildDominancePayload(sparseEndingParams).dataset.source).toEqual([
			[1660000000000, 100, 0],
			[1660086400000, 0, 100]
		])
	})

	it('matches legacy synthetic tails without allocating them or creating false inflows', () => {
		const stalePoint = { date: 1_660_000_000, mcap: { peggedUSD: 10 } }
		const currentSeries = [
			{ date: 1_660_000_000, mcap: { peggedUSD: 20 } },
			{ date: 1_660_086_400, mcap: { peggedUSD: 25 } },
			{ date: 1_660_172_800, mcap: { peggedUSD: 30 } }
		]
		const baseParams = {
			assetsOrChainsList: ['Stale', 'Current'],
			issuanceType: 'mcap' as const,
			selectedChain: 'All',
			carryForwardAfterSeriesEnd: true
		}
		const compactParams = { ...baseParams, chartDataByAssetOrChain: [[stalePoint], currentSeries] }
		const paddedParams = {
			...baseParams,
			chartDataByAssetOrChain: [
				[
					stalePoint,
					{ ...stalePoint, date: 1_660_086_400, isSynthetic: true },
					{ ...stalePoint, date: 1_660_172_800, isSynthetic: true }
				],
				currentSeries
			]
		}

		expect(buildTotalMcapPayload(compactParams).dataset).toEqual(buildTotalMcapPayload(paddedParams).dataset)
		expect(buildAreaPayload(compactParams, { stackName: 'tokens' }).dataset).toEqual(
			buildAreaPayload(paddedParams, { stackName: 'tokens' }).dataset
		)
		expect(buildDominancePayload(compactParams).dataset).toEqual(buildDominancePayload(paddedParams).dataset)
		const inflows = buildTokenInflowsPayload(compactParams)
		expect(inflows.dataset.dimensions).toEqual(['timestamp', 'Current'])
		expect(inflows.dataset.source).toEqual([
			[1_660_000_000_000, 5],
			[1_660_086_400_000, 5]
		])
		expect(compactParams.chartDataByAssetOrChain.map((series) => series.length)).toEqual([1, 3])
	})

	it('keeps token inflow series within their different ending calendars', () => {
		const tokenInflows = buildTokenInflowsPayload({
			chartDataByAssetOrChain: [
				[
					{ date: 1660000000, mcap: { peggedUSD: 10 } },
					{ date: 1660086400, mcap: { peggedUSD: 15 } }
				],
				[
					{ date: 1660086400, mcap: { peggedUSD: 20 } },
					{ date: 1660172800, mcap: { peggedUSD: 12 } }
				]
			],
			assetsOrChainsList: ['Ended', 'Current'],
			issuanceType: 'mcap',
			selectedChain: 'All'
		})

		expect(tokenInflows.dataset.source).toEqual([
			[1660000000000, 5, undefined],
			[1660086400000, undefined, -8]
		])
	})

	it('does not leak values across three disjoint packed series', () => {
		const area = buildAreaPayload(
			{
				chartDataByAssetOrChain: [
					[{ date: 1660000000, circulating: 10 }],
					[{ date: 1660086400, circulating: 20 }],
					[{ date: 1660172800, circulating: 30 }]
				],
				assetsOrChainsList: ['First', 'Second', 'Third'],
				issuanceType: 'circulating'
			},
			{ stackName: 'chains' }
		)

		expect(area.dataset.source).toEqual([
			[1660000000000, 10, undefined, undefined],
			[1660086400000, undefined, 20, undefined],
			[1660172800000, undefined, undefined, 30]
		])
	})

	it('builds dominance rows as a 100 percent stacked payload', () => {
		const payload = buildDominancePayload(params)

		expect(payload.valueSymbol).toBe('%')
		expect(payload.expandTo100Percent).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.type === 'line' && chart.stack === 'dominance')).toBe(true)
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'USDT', 'USDC'])
		expect(payload.dataset.source.at(-1)).toEqual([1609632000000, 62.5, 37.5])
	})

	it('preserves dense asset rows and exactly normalized dominance', () => {
		const assetParams = {
			chartDataByAssetOrChain: [
				[{ date: 1660000000, circulating: 1 }],
				[{ date: 1660000000, circulating: 1 }],
				[
					{ date: 1659913600, circulating: 2 },
					{ date: 1660000000, circulating: 1 }
				]
			],
			assetsOrChainsList: ['A', 'B', 'C'],
			issuanceType: 'circulating'
		}
		const area = buildAreaPayload(assetParams, { stackName: 'chains', fillMissingValues: true })
		const dominance = buildDominancePayload(assetParams)

		expect(area.dataset.source[0]).toEqual([1659913600000, 0, 0, 2])
		const row = dominance.dataset.source.at(-1)!
		expect((row[1] as number) + (row[2] as number) + (row[3] as number)).toBe(100)
	})

	it('keeps token inflows stacked because they render as bars', () => {
		const payload = buildTokenInflowsPayload(params)

		expect(payload.stacked).toBe(true)
		expect(payload.showTotalInTooltip).toBe(true)
		expect(payload.charts.every((chart) => chart.type === 'bar' && chart.stack === 'tokenInflows')).toBe(true)
		expect(payload.charts.every((chart) => chart.large === false)).toBe(true)

		const cumulative = groupStablecoinBarChartPayload(payload, 'cumulative')
		expect(cumulative.charts.every((chart) => chart.type === 'line' && chart.stack === 'tokenInflows')).toBe(true)
		expect(cumulative.charts.every((chart) => chart.large == null)).toBe(true)
	})

	it('bounds the initial breakdown and aggregates every omitted value into one exact Others series', () => {
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
		}

		const uncapped = buildAreaPayload(largeParams, { stackName: 'tokenMcaps' })
		expect(uncapped.charts).toHaveLength(names.length)
		expect(uncapped.dataset.dimensions).toEqual(['timestamp', ...names])

		const area = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(area.defaultSeries).toEqual([
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
		])
		expect(area.charts).toHaveLength(STABLECOIN_BREAKDOWN_SERIES_LIMIT + 1)
		expect(area.dataset.dimensions).toEqual(['timestamp', ...area.defaultSeries!, 'Others'])
		expect(datasetValue(area.dataset, 0, 'Others')).toBe(8)
		expect(datasetValue(area.dataset, 1, 'Others')).toBe(80)

		const dominance = buildDominancePayload(largeParams, { seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT })
		expect(datasetValue(dominance.dataset, 1, 'Token12')).toBe(14.46)
		expect(datasetValue(dominance.dataset, 1, 'Others')).toBeCloseTo(9.65)
		expect(dominance.dataset.source[1].slice(1).reduce<number>((sum, value) => sum + (value as number), 0)).toBe(100)
		const tokenInflows = buildTokenInflowsPayload(largeParams, {
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(tokenInflows.charts).toHaveLength(STABLECOIN_BREAKDOWN_SERIES_LIMIT + 1)
		expect(datasetValue(tokenInflows.dataset, 0, 'Token12')).toBe(108)
		expect(datasetValue(tokenInflows.dataset, 0, 'Others')).toBe(72)

		const selected = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: ['Token1'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selected.dataset.dimensions).toEqual(['timestamp', 'Token1'])
		expect(selected.dataset.source.at(-1)).toEqual([1700086400000, 10])

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

		const selectedDominance = buildDominancePayload(largeParams, {
			selectedNames: ['Token1', 'Token2'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(datasetValue(selectedDominance.dataset, 1, 'Token1')).toBeCloseTo(33.33)
		expect(datasetValue(selectedDominance.dataset, 1, 'Token2')).toBeCloseTo(66.67)
		expect(selectedDominance.charts.map((chart) => chart.name)).toEqual(['Token2', 'Token1'])

		const selectedPair = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: ['Token2', 'Token1'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selectedPair.charts.find((chart) => chart.name === 'Token1')?.color).toBe(selected.charts[0].color)

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

	it('keeps the rendered series count constant for a 400-series input', () => {
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

	it('groups stablecoin inflow bar payloads by the selected interval', () => {
		const payload: StablecoinChartSeriesPayload = {
			dataset: {
				dimensions: ['timestamp', 'Inflows'],
				source: [
					[Date.UTC(2024, 0, 3), 100],
					[Date.UTC(2024, 0, 20), -25],
					[Date.UTC(2024, 1, 1), 50]
				]
			},
			charts: [{ type: 'bar' as const, name: 'Inflows', encode: { x: 'timestamp', y: 'Inflows' } }],
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
	it('keeps chain rows sorted with exact null and dominance values', () => {
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
				dominance: { name: 'USDT', value: '90.91' },
				mcaptvl: null
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
				dominance: { name: 'USDC', value: '50.00' },
				mcaptvl: null
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
				dominance: null,
				mcaptvl: null
			}
		])
	})
})
