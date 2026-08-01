import { describe, expect, expectTypeOf, it } from 'vitest'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import {
	buildComputedBreakdownResult,
	buildProtocolBreakdownPresentation,
	MAX_PROTOCOL_BREAKDOWN_SERIES,
	type ProtocolBreakdownChart,
	useProtocolBreakdownCharts
} from '../useProtocolBreakdownCharts'

const DAY_MS = 24 * 60 * 60 * 1e3
const HOUR_MS = 60 * 60 * 1e3

function datasetValue(dataset: MultiSeriesChartDataset | null, rowIndex: number, dimension: string) {
	if (!dataset) throw new Error('Expected chart dataset')
	const row = dataset.source[rowIndex]
	if (!row) throw new Error(`Expected chart row ${rowIndex}`)
	return row[dataset.dimensions.indexOf(dimension)]
}

describe('ProtocolOverview breakdown chart computation', () => {
	it('keeps token exclusions impossible for treasury hook requests', () => {
		type HookParams = Parameters<typeof useProtocolBreakdownCharts>[0]
		type TreasuryParamsWithExclusions = {
			protocol: string
			source: 'treasury'
			keys: ['OwnTokens']
			tokensToExclude: ['GT']
		}
		type TreasuryAcceptsExclusions = TreasuryParamsWithExclusions extends HookParams ? true : false

		expectTypeOf<TreasuryAcceptsExclusions>().toEqualTypeOf<false>()
	})

	it('keeps aligned totals, labels, USD inflows, token inflows, and latest token filtering exact', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [
				[
					[DAY_MS, 100],
					[DAY_MS * 2, 200]
				],
				[
					[DAY_MS, 10],
					[DAY_MS * 2 + HOUR_MS, 20]
				]
			],
			chainBreakdownCharts: [
				[
					[DAY_MS, { Ethereum: 100 }],
					[DAY_MS * 2, { Ethereum: 200 }]
				],
				[
					[DAY_MS, { Arbitrum: 10 }],
					[DAY_MS * 2 + HOUR_MS, { Arbitrum: 20 }]
				]
			],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { USDC: 100, ETH: 200, UNKNOWN0: 50 }],
					[DAY_MS * 2, { USDC: 110, ETH: 220, UNKNOWN0: 60 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { USDC: 100, ETH: 2, MISSING: 1, ZERO: 1 }],
					[DAY_MS * 2, { USDC: 105, ETH: 2.5, MISSING: 2, ZERO: 2 }]
				]
			],
			valueSeriesName: 'Total',
			inflows: true
		})

		expect(result.valueDataset).toEqual({
			source: [
				[DAY_MS, 110],
				[DAY_MS * 2 + HOUR_MS, 220]
			],
			dimensions: ['timestamp', 'Total']
		})
		expect(result.chainsUnique).toEqual(['Ethereum', 'Arbitrum'])
		expect(result.chainBreakdown).toEqual([
			[DAY_MS, { Ethereum: 100, Arbitrum: 10 }],
			[DAY_MS * 2 + HOUR_MS, { Ethereum: 200, Arbitrum: 20 }]
		])
		expect(result.tokensUnique).toEqual(['ETH', 'USDC', 'UNKNOWN0'])
		expect(result.tokenBreakdownPieSeries.peers).toEqual([
			{ name: 'ETH', value: 220 },
			{ name: 'USDC', value: 110 }
		])
		expect(result.inflowTokensUnique).toEqual(['ETH', 'USDC', 'MISSING', 'ZERO'])
		expect(result.tokenInflows).toEqual([[DAY_MS * 2, { ETH: 44, USDC: 5.238095238095238 }]])
		expect(result.usdInflowsDataset?.source[0]?.[0]).toBe(DAY_MS * 2)
		expect(result.usdInflowsDataset?.source[0]?.[1] as number).toBeCloseTo(49.23809523809524)
	})

	it('anchors composites to the base chart and rejects sparse or far-only required rows', () => {
		const farTimestamp = DAY_MS * 4 + HOUR_MS
		const result = buildComputedBreakdownResult({
			tvlCharts: [
				[
					[DAY_MS, 100],
					[DAY_MS * 2, 200]
				],
				[
					[DAY_MS, 10],
					[DAY_MS * 2 + HOUR_MS, 20]
				],
				[
					[DAY_MS, 1],
					[farTimestamp, 2]
				]
			],
			chainBreakdownCharts: [
				[
					[DAY_MS, { Base: 100 }],
					[DAY_MS * 2, { Base: 200 }]
				],
				[
					[DAY_MS, { Near: 10 }],
					[DAY_MS * 2 + HOUR_MS, { Near: 20 }]
				],
				[
					[DAY_MS, { Far: 1 }],
					[farTimestamp, { Far: 2 }]
				]
			],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 200 }]
				],
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2 + HOUR_MS, { TOKEN: 20 }]
				],
				[
					[DAY_MS, { TOKEN: 1 }],
					[farTimestamp, { TOKEN: 2 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2, { TOKEN: 20 }]
				],
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2 + HOUR_MS, { TOKEN: 20 }]
				],
				[
					[DAY_MS, { TOKEN: 10 }],
					[farTimestamp, { TOKEN: 20 }]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.valueDataset).toEqual({
			source: [
				[DAY_MS, 111],
				[DAY_MS * 2 + HOUR_MS, null]
			],
			dimensions: ['timestamp', 'Total']
		})
		expect(result.chainBreakdown).toEqual([[DAY_MS, { Base: 100, Near: 10, Far: 1 }]])
		expect(result.chainBreakdown?.some(([timestamp]) => timestamp === farTimestamp)).toBe(false)
		expect(result.tokenInflows).toBeNull()
		expect(result.usdInflowsDataset).toBeNull()
	})

	it('treats successful empty sources as zero while keeping unavailable sources unavailable', () => {
		const baseValueChart = [
			[DAY_MS, 100],
			[DAY_MS * 2, 200]
		] as Array<[number, number]>
		const baseBreakdown = [
			[DAY_MS, { Base: 100 }],
			[DAY_MS * 2, { Base: 200 }]
		] as Array<[number, Record<string, number>]>
		const successfulEmpty = buildComputedBreakdownResult({
			tvlCharts: [baseValueChart, []],
			chainBreakdownCharts: [baseBreakdown, []],
			tokenBreakdownUsdCharts: [],
			tokenBreakdownRawCharts: [],
			valueSeriesName: 'Total'
		})
		const unavailable = buildComputedBreakdownResult({
			tvlCharts: [baseValueChart, undefined],
			chainBreakdownCharts: [baseBreakdown, undefined],
			tokenBreakdownUsdCharts: [],
			tokenBreakdownRawCharts: [],
			valueSeriesName: 'Total'
		})

		expect(successfulEmpty.valueDataset?.source).toEqual(baseValueChart)
		expect(successfulEmpty.chainBreakdown).toEqual(baseBreakdown)
		expect(unavailable.valueDataset).toBeNull()
		expect(unavailable.chainBreakdown).toBeNull()
	})

	it('derives USD inflows from token balances instead of TVL value changes', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [
				[
					[DAY_MS, 100],
					[DAY_MS * 2, 100],
					[DAY_MS * 3, 150]
				]
			],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 200 }],
					[DAY_MS * 3, { TOKEN: 300 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2, { TOKEN: 20 }],
					[DAY_MS * 3, { TOKEN: 20 }]
				]
			],
			valueSeriesName: 'Total'
		})

		// A deposit counts even when total TVL is flat; the later price-only gain does not.
		expect(result.tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: 100 }]])
		expect(result.usdInflowsDataset).toEqual({
			source: [[DAY_MS * 2, 100]],
			dimensions: ['timestamp', 'USD Inflows']
		})
	})

	it('does not derive inflows across a missing required USD breakdown point', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [[[DAY_MS, { TOKEN: 100 }]]],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2, { TOKEN: 20 }]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.tokenInflows).toBeNull()
		expect(result.usdInflowsDataset).toBeNull()
	})

	it('keeps every eligible latest token selectable while preserving the pie dust filter', () => {
		const latest = Object.fromEntries([
			...Array.from({ length: 17 }, (_, index) => [`Token ${index}`, 20 - index] as const),
			['Dust', 0.5] as const
		])
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [[[DAY_MS, latest]]],
			tokenBreakdownRawCharts: [],
			valueSeriesName: 'Total',
			inflows: true,
			computeInflows: false
		})

		expect(result.tokenBreakdownPieSeries.peers).toHaveLength(17)
		expect(result.tokenBreakdownPieSeries.peers.some((peer) => peer.name === 'Dust')).toBe(false)
		const presentation = buildRuntimePieChartPresentation({ series: result.tokenBreakdownPieSeries })
		expect(presentation.chartData).toHaveLength(16)
		expect(presentation.chartData.at(-1)?.name).toBe('Others')

		const fullPositiveResult = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [[[DAY_MS, latest]]],
			tokenBreakdownRawCharts: [],
			valueSeriesName: 'Total',
			inflows: true,
			computeInflows: false,
			tokenPieMinimumValue: 0
		})
		expect(fullPositiveResult.tokenBreakdownPieSeries.peers.at(-1)).toEqual({ name: 'Dust', value: 0.5 })
	})

	it('retains an Others-only source for runtime presentation', () => {
		const input = {
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [[[DAY_MS, { Others: 5 }]]] as Array<Array<[number, Record<string, number>]>>,
			tokenBreakdownRawCharts: [],
			valueSeriesName: 'Total',
			inflows: true,
			computeInflows: false
		}
		const result = buildComputedBreakdownResult(input)

		expect(result.tokenBreakdownPieSeries).toEqual({ peers: [], limit: 15, upstreamOthersValue: 5 })
	})

	it('uses the price from the side with the larger USD notional', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 2_000 }],
					[DAY_MS * 2, { TOKEN: 1_000 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 10 }]
				]
			],
			valueSeriesName: 'Total'
		})

		// Previous notional is larger, so the withdrawal uses its $20 price instead of the current $100 price.
		expect(result.tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: -1_800 }]])
		expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 2, -1_800]])
	})

	it('rejects a balance jump larger than twice its price reference', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 10 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 1 }],
					[DAY_MS * 2, { TOKEN: 1_000 }]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.tokenInflows).toBeNull()
		expect(result.usdInflowsDataset).toBeNull()
	})

	it('keeps a normal balance flow below the outlier threshold', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 150 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2, { TOKEN: 15 }]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: 50 }]])
		expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 2, 50]])
	})

	it('does not derive a token price from non-positive raw balances', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 50 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: -10 }],
					[DAY_MS * 2, { TOKEN: -5 }]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.tokenInflows).toBeNull()
		expect(result.usdInflowsDataset).toBeNull()
	})

	it('computes each source inflow before summing sources with different token prices', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 150 }]
				],
				[
					[DAY_MS, { TOKEN: 20 }],
					[DAY_MS * 2, { TOKEN: 10 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2, { TOKEN: 15 }]
				],
				[
					[DAY_MS, { TOKEN: 20 }],
					[DAY_MS * 2, { TOKEN: 10 }]
				]
			],
			valueSeriesName: 'Total'
		})

		// Source flows are +$50 and -$10. Calculating after aggregation would incorrectly produce -$32.
		expect(result.tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: 40 }]])
		expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 2, 40]])
	})

	it('keeps valid zero source intervals when merging inflows in either requested order', () => {
		const unchangedUsd: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 100 }],
			[DAY_MS * 2, { TOKEN: 100 }]
		]
		const unchangedRaw: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 10 }],
			[DAY_MS * 2, { TOKEN: 10 }]
		]
		const inflowUsd: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 100 }],
			[DAY_MS * 2, { TOKEN: 150 }]
		]
		const inflowRaw: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 10 }],
			[DAY_MS * 2, { TOKEN: 15 }]
		]
		const build = (
			tokenBreakdownUsdCharts: ProtocolBreakdownChart[],
			tokenBreakdownRawCharts: ProtocolBreakdownChart[]
		) =>
			buildComputedBreakdownResult({
				tvlCharts: [],
				chainBreakdownCharts: [],
				tokenBreakdownUsdCharts,
				tokenBreakdownRawCharts,
				valueSeriesName: 'Total'
			})

		const zeroFirst = build([unchangedUsd, inflowUsd], [unchangedRaw, inflowRaw])
		const inflowFirst = build([inflowUsd, unchangedUsd], [inflowRaw, unchangedRaw])
		const successfulEmptyExtra = build([inflowUsd, []], [inflowRaw, []])

		for (const result of [zeroFirst, inflowFirst, successfulEmptyExtra]) {
			expect(result.tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: 50 }]])
			expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 2, 50]])
		}
	})

	it('rejects sparse inflow cadence without bridging in either requested order', () => {
		const denseUsd: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 100 }],
			[DAY_MS * 2, { TOKEN: 110 }],
			[DAY_MS * 3, { TOKEN: 120 }]
		]
		const denseRaw: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 10 }],
			[DAY_MS * 2, { TOKEN: 11 }],
			[DAY_MS * 3, { TOKEN: 12 }]
		]
		const sparseUsd: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 100 }],
			[DAY_MS * 3, { TOKEN: 120 }]
		]
		const sparseRaw: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 10 }],
			[DAY_MS * 3, { TOKEN: 12 }]
		]
		const build = (usdCharts: ProtocolBreakdownChart[], rawCharts: ProtocolBreakdownChart[]) =>
			buildComputedBreakdownResult({
				tvlCharts: [],
				chainBreakdownCharts: [],
				tokenBreakdownUsdCharts: usdCharts,
				tokenBreakdownRawCharts: rawCharts,
				valueSeriesName: 'Total'
			})

		for (const result of [
			build([sparseUsd, denseUsd], [sparseRaw, denseRaw]),
			build([denseUsd, sparseUsd], [denseRaw, sparseRaw])
		]) {
			expect(result.tokenInflows).toBeNull()
			expect(result.usdInflowsDataset).toBeNull()
		}
	})

	it('requires latest-aligned source intervals to retain a valid daily cadence', () => {
		const build = (alignedLatestTimestamp: number) =>
			buildComputedBreakdownResult({
				tvlCharts: [],
				chainBreakdownCharts: [],
				tokenBreakdownUsdCharts: [
					[
						[DAY_MS, { TOKEN: 100 }],
						[DAY_MS * 2, { TOKEN: 100 }]
					],
					[
						[DAY_MS, { TOKEN: 100 }],
						[alignedLatestTimestamp, { TOKEN: 150 }]
					]
				],
				tokenBreakdownRawCharts: [
					[
						[DAY_MS, { TOKEN: 10 }],
						[DAY_MS * 2, { TOKEN: 10 }]
					],
					[
						[DAY_MS, { TOKEN: 10 }],
						[alignedLatestTimestamp, { TOKEN: 15 }]
					]
				],
				valueSeriesName: 'Total'
			})

		const earlierShiftedLatest = DAY_MS * 2 - HOUR_MS
		const exactDailyLatest = DAY_MS * 2
		const positiveShiftedLatest = DAY_MS * 2 + HOUR_MS
		expect(build(earlierShiftedLatest).tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: 50 }]])
		expect(build(exactDailyLatest).tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: 50 }]])
		expect(build(positiveShiftedLatest).tokenInflows).toBeNull()
	})

	it('recovers on the next valid base interval after rejecting a cadence over 24 hours', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2 + 1, { TOKEN: 110 }],
					[DAY_MS * 3 + 1, { TOKEN: 120 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2 + 1, { TOKEN: 11 }],
					[DAY_MS * 3 + 1, { TOKEN: 12 }]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.tokenInflows).toEqual([[DAY_MS * 3 + 1, { TOKEN: 10 }]])
		expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 3 + 1, 10]])
	})

	it('rejects non-increasing base inflow intervals', () => {
		const build = (timestamps: [number, number]) =>
			buildComputedBreakdownResult({
				tvlCharts: [],
				chainBreakdownCharts: [],
				tokenBreakdownUsdCharts: [
					[
						[timestamps[0], { TOKEN: 100 }],
						[timestamps[1], { TOKEN: 150 }]
					]
				],
				tokenBreakdownRawCharts: [
					[
						[timestamps[0], { TOKEN: 10 }],
						[timestamps[1], { TOKEN: 15 }]
					]
				],
				valueSeriesName: 'Total'
			})

		expect(build([DAY_MS, DAY_MS]).tokenInflows).toBeNull()
		expect(build([DAY_MS * 2, DAY_MS]).tokenInflows).toBeNull()
	})

	it('rejects raw and USD observations with different endpoint timestamps', () => {
		const rawChart: ProtocolBreakdownChart = [
			[DAY_MS, { TOKEN: 10 }],
			[DAY_MS * 2, { TOKEN: 15 }]
		]
		const currentMismatch = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 3, { TOKEN: 150 }]
				]
			],
			tokenBreakdownRawCharts: [rawChart],
			valueSeriesName: 'Total'
		})
		const previousMismatch = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS + HOUR_MS, { TOKEN: 100 }],
					[DAY_MS * 2, { TOKEN: 150 }]
				]
			],
			tokenBreakdownRawCharts: [rawChart],
			valueSeriesName: 'Total'
		})

		expect(currentMismatch.tokenInflows).toBeNull()
		expect(currentMismatch.usdInflowsDataset).toBeNull()
		expect(previousMismatch.tokenInflows).toBeNull()
		expect(previousMismatch.usdInflowsDataset).toBeNull()
	})

	it('keeps canonical raw rows intact while using peak USD only for default membership', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 500_000, MISSING: 2_000_000, FILTERED: 400_000 }],
					[DAY_MS * 2, {}]
				],
				[
					[DAY_MS, { TOKEN: 2_000_000 }],
					[DAY_MS * 2, { TOKEN: 2_100_000 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 200_000_000, MISSING: 1, FILTERED: 200_000_000 }],
					[DAY_MS * 2, { TOKEN: 200_000_000, MISSING: 2, FILTERED: 200_000_000 }]
				],
				[
					[DAY_MS, { TOKEN: 1 }],
					[DAY_MS * 2, { TOKEN: 2 }]
				]
			],
			valueSeriesName: 'Total',
			computeInflows: false
		})

		expect(result.tokenBreakdownUSD).toEqual([
			[DAY_MS, { TOKEN: 2_500_000, MISSING: 2_000_000, FILTERED: 400_000 }],
			[DAY_MS * 2, { TOKEN: 2_100_000 }]
		])
		expect(result.tokenRawBreakdown).toEqual([
			[DAY_MS, { TOKEN: 200_000_001, MISSING: 1, FILTERED: 200_000_000 }],
			[DAY_MS * 2, { TOKEN: 200_000_002, MISSING: 2, FILTERED: 200_000_000 }]
		])
		expect(result.rawTokensUnique).toEqual(['TOKEN', 'FILTERED', 'MISSING'])
		expect(result.defaultRawTokens).toEqual(['TOKEN', 'MISSING', 'FILTERED'])
	})

	it('keeps a raw-only source when that source has no USD history', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [null],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 200_000_000 }],
					[DAY_MS * 2, { TOKEN: 210_000_000 }]
				]
			],
			valueSeriesName: 'Total',
			computeInflows: false
		})

		expect(result.tokenRawBreakdown).toEqual([
			[DAY_MS, { TOKEN: 200_000_000 }],
			[DAY_MS * 2, { TOKEN: 210_000_000 }]
		])
	})

	it('excludes synthetic and never-positive balances from selection without rewriting canonical rows', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100, USDT0: 200, UNKNOWN_A: 300 }],
					[DAY_MS * 2, { TOKEN: 110, USDT0: 210, UNKNOWN_A: 310 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10, USDT0: -132_666_022, UNKNOWN_A: 30 }],
					[DAY_MS * 2, { TOKEN: 11, USDT0: -132_666_023, UNKNOWN_A: 31 }]
				]
			],
			valueSeriesName: 'Total',
			computeInflows: false
		})

		expect(result.rawTokensUnique).toEqual(['TOKEN'])
		expect(result.tokenRawBreakdown).toEqual([
			[DAY_MS, { TOKEN: 10, USDT0: -132_666_022, UNKNOWN_A: 30 }],
			[DAY_MS * 2, { TOKEN: 11, USDT0: -132_666_023, UNKNOWN_A: 31 }]
		])
	})

	it('omits token and inflow datasets when inflows are disabled', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [
				[
					[DAY_MS, 100],
					[DAY_MS * 2, 125]
				]
			],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { USDC: 100 }],
					[DAY_MS * 2, { USDC: 125 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { USDC: 100 }],
					[DAY_MS * 2, { USDC: 125 }]
				]
			],
			valueSeriesName: 'Treasury',
			inflows: false
		})

		expect(result.valueDataset?.dimensions).toEqual(['timestamp', 'Treasury'])
		expect(result.tokenBreakdownUSD).toBeNull()
		expect(result.tokenRawBreakdown).toBeNull()
		expect(result.usdInflowsDataset).toBeNull()
		expect(result.tokenInflows).toBeNull()
	})

	it('keeps token datasets but skips inflow construction when the caller does not render inflows', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { USDC: 100 }],
					[DAY_MS * 2, { USDC: 125 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { USDC: 100 }],
					[DAY_MS * 2, { USDC: 125 }]
				]
			],
			valueSeriesName: 'Total',
			computeInflows: false
		})

		expect(result.tokensUnique).toEqual(['USDC'])
		expect(result.rawTokensUnique).toEqual(['USDC'])
		expect(result.usdInflowsDataset).toBeNull()
		expect(result.tokenInflows).toBeNull()
	})

	it('keeps a disappearing token as a full withdrawal', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { TOKEN: 100 }],
					[DAY_MS * 2, {}]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { TOKEN: 10 }],
					[DAY_MS * 2, {}]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.tokenInflows).toEqual([[DAY_MS * 2, { TOKEN: -100 }]])
		expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 2, -100]])
	})

	it('bounds chain breakdowns and aggregates every omitted chain exactly', () => {
		const chains: Record<string, number> = {}
		for (let i = 0; i < 35; i++) chains[`CHAIN_${i}`] = i + 1

		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [[[DAY_MS, chains]]],
			tokenBreakdownUsdCharts: [],
			tokenBreakdownRawCharts: [],
			valueSeriesName: 'Total',
			inflows: false
		})

		expect(result.chainsUnique).toHaveLength(35)
		expect(result.chainsUnique).not.toContain('Others')
		const presentation = buildProtocolBreakdownPresentation({
			breakdown: result.chainBreakdown,
			availableSeries: result.chainsUnique,
			activeSeries: result.chainsUnique,
			aggregateOthers: true,
			type: 'line'
		})
		expect(presentation.dataset?.dimensions).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES + 2)
		expect(presentation.dataset?.dimensions.at(-1)).toBe('Others')
		expect(datasetValue(presentation.dataset, 0, 'Others')).toBe(15)
	})

	it('preserves a backend Others series when no additional aggregation is needed', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [[[DAY_MS, { Ethereum: 100, Others: 25 }]]],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { USDC: 100, Others: 25 }],
					[DAY_MS * 2, { USDC: 110, Others: 30 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { USDC: 100, Others: 25 }],
					[DAY_MS * 2, { USDC: 105, Others: 30 }]
				]
			],
			valueSeriesName: 'Total'
		})

		const chains = buildProtocolBreakdownPresentation({
			breakdown: result.chainBreakdown,
			availableSeries: result.chainsUnique,
			activeSeries: result.chainsUnique,
			aggregateOthers: true,
			includeUpstreamOthers: true,
			type: 'line'
		})
		const tokens = buildProtocolBreakdownPresentation({
			breakdown: result.tokenBreakdownUSD,
			availableSeries: result.tokensUnique,
			activeSeries: result.tokensUnique,
			aggregateOthers: true,
			includeUpstreamOthers: true,
			type: 'line'
		})
		expect(datasetValue(chains.dataset, 0, 'Others')).toBe(25)
		expect(datasetValue(tokens.dataset, 1, 'Others')).toBe(30)
		expect(result.rawTokensUnique).not.toContain('Others')
		expect(result.inflowTokensUnique).toEqual(['USDC'])
		expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 2, 5.238095238095238]])
	})

	it('bounds visible token series and aggregates omitted USD values and inflows exactly', () => {
		const usdDayOne: Record<string, number> = {}
		const usdDayTwo: Record<string, number> = {}
		const rawDayOne: Record<string, number> = {}
		const rawDayTwo: Record<string, number> = {}
		for (let i = 0; i < 35; i++) {
			const token = `TOKEN_${i}`
			usdDayOne[token] = (i + 1) * 10
			usdDayTwo[token] = (i + 1) * 20
			rawDayOne[token] = 1
			rawDayTwo[token] = 2
		}

		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, usdDayOne],
					[DAY_MS * 2, usdDayTwo]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, rawDayOne],
					[DAY_MS * 2, rawDayTwo]
				]
			],
			valueSeriesName: 'Total'
		})

		expect(result.tokensUnique).toHaveLength(35)
		expect(result.tokensUnique).not.toContain('Others')
		expect(result.rawTokensUnique).toHaveLength(35)
		expect(result.rawTokensUnique).not.toContain('Others')
		const usdPresentation = buildProtocolBreakdownPresentation({
			breakdown: result.tokenBreakdownUSD,
			availableSeries: result.tokensUnique,
			activeSeries: result.tokensUnique,
			aggregateOthers: true,
			type: 'line'
		})
		const rawPresentation = buildProtocolBreakdownPresentation({
			breakdown: result.tokenRawBreakdown,
			availableSeries: result.rawTokensUnique,
			activeSeries: result.defaultRawTokens,
			aggregateOthers: false,
			type: 'line'
		})
		const inflowPresentation = buildProtocolBreakdownPresentation({
			breakdown: result.tokenInflows,
			availableSeries: result.inflowTokensUnique,
			activeSeries: result.inflowTokensUnique,
			aggregateOthers: true,
			type: 'bar'
		})
		expect(usdPresentation.charts).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES + 1)
		expect(rawPresentation.charts).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES)
		expect(inflowPresentation.charts).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES + 1)
		expect(datasetValue(usdPresentation.dataset, 1, 'Others')).toBe(300)
		expect(rawPresentation.dataset?.dimensions).not.toContain('Others')
		expect(datasetValue(inflowPresentation.dataset, 0, 'Others')).toBe(150)
		expect(result.usdInflowsDataset?.source[0]?.[1]).toBe(6_300)
	})

	it('ranks raw balances by peak historical USD value and appends tokens without USD history', () => {
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [
				[
					[DAY_MS, { PAST_LEADER: 1_000, CURRENT_LEADER: 10, FRACTIONAL: 500 }],
					[DAY_MS * 2, { PAST_LEADER: 1, CURRENT_LEADER: 100, FRACTIONAL: 400 }]
				]
			],
			tokenBreakdownRawCharts: [
				[
					[DAY_MS, { PAST_LEADER: 10_000, CURRENT_LEADER: 1, FRACTIONAL: 0.5, NO_USD: 5 }],
					[DAY_MS * 2, { PAST_LEADER: 10_000, CURRENT_LEADER: 1, FRACTIONAL: 0.4, NO_USD: 6 }]
				]
			],
			valueSeriesName: 'Total',
			computeInflows: false
		})

		expect(result.rawTokensUnique).toEqual(['PAST_LEADER', 'NO_USD', 'CURRENT_LEADER', 'FRACTIONAL'])
		expect(result.defaultRawTokens).toEqual(['PAST_LEADER', 'FRACTIONAL', 'CURRENT_LEADER'])

		const presentation = buildProtocolBreakdownPresentation({
			breakdown: result.tokenRawBreakdown,
			availableSeries: result.rawTokensUnique,
			activeSeries: result.defaultRawTokens,
			aggregateOthers: false,
			type: 'line'
		})
		expect(presentation.charts.map((chart) => chart.name)).toEqual(['PAST_LEADER', 'CURRENT_LEADER', 'FRACTIONAL'])
	})

	it('ranks token inflows by peak absolute USD flow and keeps inactive tokens selectable', () => {
		const breakdown: Array<[number, Record<string, number>]> = [
			[DAY_MS, { PAST_LEADER: 0, CURRENT_LEADER: 0, UNCHANGED: 50 }],
			[DAY_MS * 2, { PAST_LEADER: 1_000, CURRENT_LEADER: 10, UNCHANGED: 50 }],
			[DAY_MS * 3, { PAST_LEADER: 1_000, CURRENT_LEADER: 110, UNCHANGED: 50 }]
		]
		const result = buildComputedBreakdownResult({
			tvlCharts: [],
			chainBreakdownCharts: [],
			tokenBreakdownUsdCharts: [breakdown],
			tokenBreakdownRawCharts: [breakdown],
			valueSeriesName: 'Total'
		})

		expect(result.inflowTokensUnique).toEqual(['PAST_LEADER', 'CURRENT_LEADER', 'UNCHANGED'])
	})

	it('projects only the selected tail into Others and keeps canonical colors stable', () => {
		const values = Object.fromEntries(Array.from({ length: 35 }, (_, index) => [`TOKEN_${index}`, index + 1]))
		const availableSeries = Object.keys(values).toReversed()
		const full = buildProtocolBreakdownPresentation({
			breakdown: [[DAY_MS, values]],
			availableSeries,
			activeSeries: availableSeries,
			aggregateOthers: true,
			type: 'line'
		})
		const subset = buildProtocolBreakdownPresentation({
			breakdown: [[DAY_MS, values]],
			availableSeries,
			activeSeries: ['TOKEN_34', 'TOKEN_10'],
			aggregateOthers: true,
			type: 'line'
		})
		const tailSelection = buildProtocolBreakdownPresentation({
			breakdown: [[DAY_MS, values]],
			availableSeries,
			activeSeries: availableSeries.slice(1, 32),
			aggregateOthers: true,
			type: 'line'
		})

		expect(datasetValue(full.dataset, 0, 'Others')).toBe(15)
		expect(subset.dataset?.dimensions).toEqual(['timestamp', 'TOKEN_34', 'TOKEN_10'])
		expect(subset.charts[0]?.color).toBe(full.charts[0]?.color)
		expect(tailSelection.charts.find((chart) => chart.name === 'Others')?.color).not.toBe(
			tailSelection.charts.find((chart) => chart.name === 'TOKEN_5')?.color
		)
		expect(subset.dataset?.dimensions).not.toContain('Others')
	})
})
