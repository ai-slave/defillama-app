import { describe, expect, it } from 'vitest'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { buildComputedBreakdownResult, MAX_PROTOCOL_BREAKDOWN_SERIES } from '../useProtocolBreakdownCharts'

const DAY_MS = 24 * 60 * 60 * 1e3
const HOUR_MS = 60 * 60 * 1e3

function datasetValue(dataset: MultiSeriesChartDataset, rowIndex: number, dimension: string) {
	return dataset.source[rowIndex][dataset.dimensions.indexOf(dimension)]
}

describe('ProtocolOverview breakdown chart computation', () => {
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
		expect(result.chainsDataset).toEqual({
			source: [
				[DAY_MS, 100, 10],
				[DAY_MS * 2 + HOUR_MS, 200, 20]
			],
			dimensions: ['timestamp', 'Ethereum', 'Arbitrum']
		})
		expect(result.tokensUnique).toEqual(['ETH', 'USDC', 'UNKNOWN0'])
		expect(result.tokenBreakdownLatest).toEqual({ USDC: 110, ETH: 220 })
		expect(result.tokenInflowsDataset?.dimensions).toEqual(['timestamp', 'ETH', 'USDC', 'UNKNOWN0'])
		expect(result.tokenInflowsDataset?.source).toEqual([[DAY_MS * 2, 44, 5.238095238095238, undefined]])
		expect(result.usdInflowsDataset?.source[0]?.[0]).toBe(DAY_MS * 2)
		expect(result.usdInflowsDataset?.source[0]?.[1] as number).toBeCloseTo(49.23809523809524)
		expect(result.tokenInflowsCharts.map((chart) => chart.name)).toEqual(['ETH', 'USDC', 'UNKNOWN0'])
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
		expect(result.tokenInflowsDataset?.source).toEqual([[DAY_MS * 2, 100]])
		expect(result.usdInflowsDataset).toEqual({
			source: [[DAY_MS * 2, 100]],
			dimensions: ['timestamp', 'USD Inflows']
		})
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
		expect(result.tokenInflowsDataset?.source).toEqual([[DAY_MS * 2, -1_800]])
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

		expect(result.tokenInflowsDataset).toBeNull()
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

		expect(result.tokenInflowsDataset?.source).toEqual([[DAY_MS * 2, 50]])
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

		expect(result.tokenInflowsDataset).toBeNull()
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
		expect(result.tokenInflowsDataset?.source).toEqual([[DAY_MS * 2, 40]])
		expect(result.usdInflowsDataset?.source).toEqual([[DAY_MS * 2, 40]])
	})

	it('filters raw rows against each source USD row before aggregating sources', () => {
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

		expect(result.tokenUSDDataset?.source).toEqual([
			[DAY_MS, 2_500_000, 2_000_000, 400_000],
			[DAY_MS * 2, 2_100_000, undefined, undefined]
		])
		expect(result.tokenRawDataset?.source).toEqual([
			[DAY_MS, 1, 1],
			[DAY_MS * 2, 2, undefined]
		])
		expect(result.rawTokensUnique).toEqual(['TOKEN', 'MISSING'])
		expect(result.tokenRawDataset?.dimensions).not.toContain('FILTERED')
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

		expect(result.tokenRawDataset?.source).toEqual([
			[DAY_MS, 200_000_000],
			[DAY_MS * 2, 210_000_000]
		])
	})

	it('excludes unknown and non-positive balances from raw display data', () => {
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
		expect(result.tokenRawDataset?.source).toEqual([
			[DAY_MS, 10],
			[DAY_MS * 2, 11]
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
		expect(result.tokenUSDDataset).toBeNull()
		expect(result.tokenRawDataset).toBeNull()
		expect(result.usdInflowsDataset).toBeNull()
		expect(result.tokenInflowsDataset).toBeNull()
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

		expect(result.tokenUSDDataset?.dimensions).toEqual(['timestamp', 'USDC'])
		expect(result.tokenRawDataset?.dimensions).toEqual(['timestamp', 'USDC'])
		expect(result.usdInflowsDataset).toBeNull()
		expect(result.tokenInflowsDataset).toBeNull()
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

		expect(result.tokenInflowsDataset?.source).toEqual([[DAY_MS * 2, -100]])
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

		expect(result.chainsUnique).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES)
		expect(result.chainsUnique.at(-1)).toBe('Others')
		expect(result.chainsDataset?.dimensions).toEqual(['timestamp', ...result.chainsUnique])
		expect(datasetValue(result.chainsDataset!, 0, 'Others')).toBe(21)
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

		expect(result.tokensUnique).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES)
		expect(result.tokensUnique.at(-1)).toBe('Others')
		expect(result.rawTokensUnique).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES - 1)
		expect(result.rawTokensUnique).not.toContain('Others')
		expect(result.tokenUSDCharts).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES)
		expect(result.tokenRawCharts).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES - 1)
		expect(result.tokenRawDataset?.dimensions).not.toContain('Others')
		expect(result.tokenInflowsCharts).toHaveLength(MAX_PROTOCOL_BREAKDOWN_SERIES)
		expect(datasetValue(result.tokenUSDDataset!, 1, 'Others')).toBe(420)
		expect(result.tokenRawDataset?.dimensions).not.toContain('Others')
		expect(datasetValue(result.tokenInflowsDataset!, 0, 'Others')).toBe(210)
		expect(result.usdInflowsDataset?.source[0]?.[1]).toBe(6_300)
	})
})
