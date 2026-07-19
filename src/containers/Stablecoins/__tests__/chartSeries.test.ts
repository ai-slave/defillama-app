import { describe, expect, it } from 'vitest'
import {
	buildAreaPayload,
	buildStablecoinBreakdownDatasetPresentation,
	buildStablecoinBreakdownPayloadPresentation,
	buildStablecoinChartSummary,
	buildDominancePayload,
	buildStablecoinOverviewPayload,
	buildTokenInflowsPayload,
	buildTotalMcapPayload,
	buildUsdInflowsPayload,
	groupStablecoinBarChartPayload,
	STABLECOIN_BREAKDOWN_SERIES_LIMIT
} from '../chartSeries'
import { buildStablecoinChartDataWithFlags, formatPeggedChainsData } from '../utils'

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
	it('keeps overview chart payloads identical while adding their shared summary', () => {
		const topToken = { symbol: 'USDT', mcap: 150 }
		const summary = buildStablecoinChartSummary(
			buildStablecoinChartDataWithFlags(params, { total: true }).peggedAreaTotalData,
			topToken
		)
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

	it('collects combined chart outputs with one value read per source point', () => {
		let reads = 0
		const point = (date: number, value: number) => ({
			date,
			get mcap() {
				reads++
				return { peggedUSD: value }
			}
		})
		const combinedParams = {
			chartDataByAssetOrChain: [[point(1660000000, 100), point(1660086400, 125), point(1660172800, 120)]],
			assetsOrChainsList: ['USDT'],
			filteredIndexes: [0],
			issuanceType: 'mcap',
			selectedChain: 'All'
		}

		const result = buildStablecoinChartDataWithFlags(combinedParams, {
			area: true,
			total: true,
			inflows: true
		})

		expect(reads).toBe(3)
		expect(result.peggedAreaChartData).toEqual([
			{ date: '1660000000', USDT: 100 },
			{ date: '1660086400', USDT: 125 },
			{ date: '1660172800', USDT: 120 }
		])
		expect(result.peggedAreaTotalData).toEqual([
			{ date: '1660000000', Mcap: 100 },
			{ date: '1660086400', Mcap: 125 },
			{ date: '1660172800', Mcap: 120 }
		])
		expect(result.tokenInflows).toEqual([
			{ date: '1660000000', USDT: 25 },
			{ date: '1660086400', USDT: -5 }
		])
		expect(result.usdInflows).toEqual([
			['1660000000', 25],
			['1660086400', -5]
		])
	})

	it('keeps total-only collection scoped to total output', () => {
		const result = buildStablecoinChartDataWithFlags(params, { total: true })

		expect(result.peggedAreaTotalData).toHaveLength(3)
		expect(result.peggedAreaChartData).toEqual([])
		expect(result.stackedDataset).toEqual([])
		expect(result.tokenInflows).toEqual([])
		expect(result.usdInflows).toEqual([])
	})

	it('builds USD and token inflows independently', () => {
		const usdOnly = buildStablecoinChartDataWithFlags(params, { usdInflows: true })
		const tokenOnly = buildStablecoinChartDataWithFlags(params, { tokenInflows: true })

		expect(usdOnly.usdInflows).toEqual([
			['1609459200', 35],
			['1609545600', 55]
		])
		expect(usdOnly.tokenInflows).toEqual([])
		expect(usdOnly.tokenInflowNames).toEqual([])
		expect(tokenOnly.tokenInflows).toEqual([
			{ date: '1609459200', USDT: 25, USDC: 10 },
			{ date: '1609545600', USDT: 25, USDC: 30 }
		])
		expect(tokenOnly.usdInflows).toEqual([])
	})

	it('keeps total market cap ordering, currency totals, and missing values exact', () => {
		const mixedCurrencyParams = {
			chartDataByAssetOrChain: [
				[
					{ date: 1609632000, mcap: { peggedUSD: 30, peggedEUR: 5 } },
					{ date: 1609459200, mcap: { peggedUSD: 10, peggedEUR: 2 } },
					{ date: 1609545600 }
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
			{ timestamp: 1609459200000, Mcap: 15 },
			{ timestamp: 1609545600000, Mcap: 4 },
			{ timestamp: 1609632000000, Mcap: 40 }
		])
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'Mcap'])
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
			{ timestamp: 1609459200000, Mcap: 15 },
			{ timestamp: 1609545600000, Mcap: 30 }
		])
		expect(buildAreaPayload(stringDateParams, { stackName: 'tokenMcaps' }).dataset.source).toEqual([
			{ timestamp: 1609459200000, USDT: 10, USDC: 5 },
			{ timestamp: 1609545600000, USDT: 20, USDC: 10 }
		])
		expect(buildDominancePayload(stringDateParams).dataset.source).toEqual([
			{ timestamp: 1609459200000, USDT: 66.67, USDC: 33.33 },
			{ timestamp: 1609545600000, USDT: 66.67, USDC: 33.33 }
		])
	})

	it('adds unreleased values to total circulating payloads when requested', () => {
		const payload = buildTotalMcapPayload(circulatingParams, {
			totalName: 'Circulating',
			includeUnreleased: true
		})

		expect(payload.dataset.source).toEqual([
			{ timestamp: 1660000000000, Circulating: 165 },
			{ timestamp: 1660086400000, Circulating: 210 }
		])
		expect(payload.valueSymbol).toBe('')
		expect(JSON.parse(JSON.stringify(payload)).valueSymbol).toBe('')
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
			{ timestamp: 1609459200000, USDT: 10 },
			{ timestamp: 1609545600000, USDT: 20, USDC: 5 }
		])
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'USDT', 'USDC'])
	})

	it('builds dominance rows as a 100 percent stacked payload', () => {
		const payload = buildDominancePayload(params)

		expect(payload.valueSymbol).toBe('%')
		expect(payload.expandTo100Percent).toBe(true)
		expect(payload.stacked).toBe(true)
		expect(payload.charts.every((chart) => chart.type === 'line' && chart.stack === 'dominance')).toBe(true)
		expect(payload.dataset.dimensions).toEqual(['timestamp', 'USDT', 'USDC'])
		expect(payload.dataset.source.at(-1)).toMatchObject({
			timestamp: 1609632000000,
			USDT: 62.5,
			USDC: 37.5
		})
	})

	it('preserves dense asset rows and exactly normalized dominance when requested', () => {
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
		const dominance = buildDominancePayload(assetParams, { normalizeTo100: true })

		expect(area.dataset.source[0]).toEqual({ timestamp: 1659913600000, A: 0, B: 0, C: 2 })
		const row = dominance.dataset.source.at(-1)!
		expect(Number(row.A) + Number(row.B) + Number(row.C)).toBe(100)
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
		expect(area.dataset.source).toEqual([
			expect.objectContaining({ timestamp: 1700000000000, Others: 8 }),
			expect.objectContaining({ timestamp: 1700086400000, Others: 80 })
		])
		expect(
			buildStablecoinBreakdownPayloadPresentation({
				payload: uncapped,
				seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
			}).dataset
		).toEqual(area.dataset)

		const dominance = buildDominancePayload(largeParams, { seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT })
		expect(dominance.dataset.source.at(-1)).toMatchObject({ Token12: 14.46, Others: 9.64 })
		const tokenInflows = buildTokenInflowsPayload(largeParams, {
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(tokenInflows.charts).toHaveLength(STABLECOIN_BREAKDOWN_SERIES_LIMIT + 1)
		expect(tokenInflows.dataset.source).toEqual([
			expect.objectContaining({ timestamp: 1700000000000, Token12: 108, Others: 72 })
		])

		const selected = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: ['Token1'],
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selected.dataset.dimensions).toEqual(['timestamp', 'Token1', 'Others'])
		expect(selected.dataset.source.at(-1)).toEqual({
			timestamp: 1700086400000,
			Token1: 10,
			Others: 820
		})

		const selectAll = buildAreaPayload(largeParams, {
			stackName: 'tokenMcaps',
			selectedNames: names,
			seriesLimit: STABLECOIN_BREAKDOWN_SERIES_LIMIT
		})
		expect(selectAll.dataset.dimensions).toEqual([
			'timestamp',
			'Token1',
			'Token2',
			'Token3',
			'Token4',
			'Token5',
			'Token6',
			'Token7',
			'Token8',
			'Token9',
			'Token10',
			'Others'
		])
		expect(selectAll.dataset.source.at(-1)).toMatchObject({ Token1: 10, Token10: 100, Others: 280 })
	})

	it('applies the same top-N and reserved Others contract to an existing Pro dataset', () => {
		const presentation = buildStablecoinBreakdownDatasetPresentation({
			dataset: {
				dimensions: ['timestamp', 'Small', 'Large', 'Others'],
				source: [
					{ timestamp: '1700000000000', Small: 2, Large: 10, Others: 3 },
					{ timestamp: '1700086400000', Small: 4, Large: 20, Others: 6 }
				]
			},
			seriesNames: ['Small', 'Large', 'Others'],
			seriesLimit: 1
		})

		expect(presentation.availableSeries).toEqual(['Large', 'Small'])
		expect(presentation.defaultSeries).toEqual(['Large'])
		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Large', 'Others'],
			source: [
				{ timestamp: 1700000000000, Large: 10, Others: 5 },
				{ timestamp: 1700086400000, Large: 20, Others: 10 }
			]
		})
	})

	it('keeps __proto__ as an own stablecoin series value', () => {
		const payload = buildAreaPayload(
			{
				chartDataByAssetOrChain: [[{ date: '1700000000', mcap: { peggedUSD: 25 } }]],
				assetsOrChainsList: ['__proto__'],
				issuanceType: 'mcap',
				selectedChain: 'All'
			},
			{ stackName: 'tokenMcaps' }
		)
		const row = payload.dataset.source[0]

		expect(payload.dataset.dimensions).toEqual(['timestamp', '__proto__'])
		expect(Object.hasOwn(row, '__proto__')).toBe(true)
		expect(row.__proto__).toBe(25)
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
		expect(payload.dataset.source).toEqual([
			expect.objectContaining({ timestamp: 1700000000000, Token400: 400, Others: 76_245 })
		])
	})

	it('groups stablecoin inflow bar payloads by the selected interval', () => {
		const payload = {
			dataset: {
				dimensions: ['timestamp', 'Inflows'],
				source: [
					{ timestamp: Date.UTC(2024, 0, 3), Inflows: 100 },
					{ timestamp: Date.UTC(2024, 0, 20), Inflows: -25 },
					{ timestamp: Date.UTC(2024, 1, 1), Inflows: 50 }
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
					{ timestamp: Date.UTC(2024, 0, 1), Inflows: 75 },
					{ timestamp: Date.UTC(2024, 1, 1), Inflows: 50 }
				]
			}
		})
		expect(groupStablecoinBarChartPayload(payload, 'cumulative')).toEqual({
			...payload,
			charts: [{ type: 'line', name: 'Inflows', encode: { x: 'timestamp', y: 'Inflows' } }],
			dataset: {
				dimensions: ['timestamp', 'Inflows'],
				source: [
					{ timestamp: Date.UTC(2024, 0, 3), Inflows: 100 },
					{ timestamp: Date.UTC(2024, 0, 20), Inflows: 75 },
					{ timestamp: Date.UTC(2024, 1, 1), Inflows: 125 }
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
