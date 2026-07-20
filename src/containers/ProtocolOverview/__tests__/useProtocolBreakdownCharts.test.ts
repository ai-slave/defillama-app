import { describe, expect, it } from 'vitest'
import { buildComputedBreakdownResult, MAX_PROTOCOL_BREAKDOWN_SERIES } from '../useProtocolBreakdownCharts'

const DAY_MS = 24 * 60 * 60 * 1e3
const HOUR_MS = 60 * 60 * 1e3

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
				{ timestamp: DAY_MS, Total: 110 },
				{ timestamp: DAY_MS * 2 + HOUR_MS, Total: 220 }
			],
			dimensions: ['timestamp', 'Total']
		})
		expect(result.chainsUnique).toEqual(['Ethereum', 'Arbitrum'])
		expect(result.chainsDataset).toEqual({
			source: [
				{ timestamp: DAY_MS, Ethereum: 100, Arbitrum: 10 },
				{ timestamp: DAY_MS * 2 + HOUR_MS, Ethereum: 200, Arbitrum: 20 }
			],
			dimensions: ['timestamp', 'Ethereum', 'Arbitrum']
		})
		expect(result.tokensUnique).toEqual(['ETH', 'USDC', 'UNKNOWN0'])
		expect(result.tokenBreakdownLatest).toEqual({ USDC: 110, ETH: 220 })
		expect(result.tokenInflowsDataset?.dimensions).toEqual(['timestamp', 'ETH', 'USDC', 'UNKNOWN0'])
		expect(result.tokenInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, ETH: 44, USDC: 5.238095238095238 }])
		expect(result.usdInflowsDataset?.source[0]?.timestamp).toBe(DAY_MS * 2)
		expect(result.usdInflowsDataset?.source[0]?.['USD Inflows']).toBeCloseTo(49.23809523809524)
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
		expect(result.tokenInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, TOKEN: 100 }])
		expect(result.usdInflowsDataset).toEqual({
			source: [{ timestamp: DAY_MS * 2, 'USD Inflows': 100 }],
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
		expect(result.tokenInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, TOKEN: -1_800 }])
		expect(result.usdInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, 'USD Inflows': -1_800 }])
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

		expect(result.tokenInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, TOKEN: 50 }])
		expect(result.usdInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, 'USD Inflows': 50 }])
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
		expect(result.tokenInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, TOKEN: 40 }])
		expect(result.usdInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, 'USD Inflows': 40 }])
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
			{ timestamp: DAY_MS, TOKEN: 2_500_000, MISSING: 2_000_000, FILTERED: 400_000 },
			{ timestamp: DAY_MS * 2, TOKEN: 2_100_000 }
		])
		expect(result.tokenRawDataset?.source).toEqual([
			{ timestamp: DAY_MS, MISSING: 1, TOKEN: 1 },
			{ timestamp: DAY_MS * 2, TOKEN: 2 }
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
			{ timestamp: DAY_MS, TOKEN: 200_000_000 },
			{ timestamp: DAY_MS * 2, TOKEN: 210_000_000 }
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
			{ timestamp: DAY_MS, TOKEN: 10 },
			{ timestamp: DAY_MS * 2, TOKEN: 11 }
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

		expect(result.tokenInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, TOKEN: -100 }])
		expect(result.usdInflowsDataset?.source).toEqual([{ timestamp: DAY_MS * 2, 'USD Inflows': -100 }])
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
		expect(result.chainsDataset?.source[0]).toMatchObject({ Others: 21 })
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
		expect(result.tokenUSDDataset?.source[1]).toMatchObject({ Others: 420 })
		expect(result.tokenRawDataset?.source[1]).not.toHaveProperty('Others')
		expect(result.tokenInflowsDataset?.source[0]).toMatchObject({ Others: 210 })
		expect(result.usdInflowsDataset?.source[0]?.['USD Inflows']).toBe(6_300)
	})

	it('preserves prototype-like token names in source rows and inflows', () => {
		const usdDayOne = JSON.parse('{"__proto__":100,"constructor":200}') as Record<string, number>
		const usdDayTwo = JSON.parse('{"__proto__":120,"constructor":240}') as Record<string, number>
		const rawDayOne = JSON.parse('{"__proto__":10,"constructor":20}') as Record<string, number>
		const rawDayTwo = JSON.parse('{"__proto__":12,"constructor":24}') as Record<string, number>
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

		const usdRow = result.tokenUSDDataset?.source[1] as Record<string, number>
		const inflowRow = result.tokenInflowsDataset?.source[0] as Record<string, number>
		expect(Object.getPrototypeOf(usdRow)).toBe(Object.prototype)
		expect(Object.getPrototypeOf(inflowRow)).toBe(Object.prototype)
		expect(Object.hasOwn(usdRow, '__proto__')).toBe(true)
		expect(usdRow.__proto__).toBe(120)
		expect(usdRow.constructor).toBe(240)
		expect(Object.hasOwn(inflowRow, '__proto__')).toBe(true)
		expect(inflowRow.__proto__).toBe(20)
		expect(inflowRow.constructor).toBe(40)
	})
})
