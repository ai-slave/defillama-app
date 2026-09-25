import { describe, expect, test } from 'vitest'
import { parseRWAPerpsChartState, type RWAPerpsChartDefaults } from '../chartState'
import { planRWAPerpsTimeSeriesQuery, rwaPerpsTimeSeriesUrl } from '../timeSeriesQuery'
import type { RWAPerpsChartMode } from '../types'

const EMPTY = { source: [], dimensions: ['timestamp'] }
const PRELOADED = {
	source: [
		{ timestamp: 1_774_483_200_000, Equities: 100 },
		{ timestamp: 1_774_569_600_000, Equities: 120 }
	],
	dimensions: ['timestamp', 'Equities']
}

function plan({
	mode = 'overview',
	scopeName = '',
	query = {},
	chartDefaults = {},
	assetClassFilter,
	includeForex = false,
	includeCex = false,
	includeCexByDefault = false,
	hasActiveMarketFilters = false,
	initialChartDataset = EMPTY
}: {
	mode?: RWAPerpsChartMode
	scopeName?: string
	query?: Record<string, string>
	chartDefaults?: RWAPerpsChartDefaults
	assetClassFilter?: string
	includeForex?: boolean
	includeCex?: boolean
	includeCexByDefault?: boolean
	hasActiveMarketFilters?: boolean
	initialChartDataset?: typeof EMPTY
}) {
	return planRWAPerpsTimeSeriesQuery({
		mode,
		scopeName,
		chartState: parseRWAPerpsChartState(query, mode, chartDefaults),
		chartDefaults,
		assetClassFilter,
		showForexToggle: mode === 'overview' && assetClassFilter == null,
		includeForex,
		includeCex,
		includeCexByDefault,
		hasActiveMarketFilters,
		hasIncludedRows: true,
		initialChartDataset
	})
}

const url = (input: Parameters<typeof plan>[0]) => rwaPerpsTimeSeriesUrl(plan(input).request)

describe('RWA perps dashboard time-series request', () => {
	test.each([
		{
			name: 'the overview leaves Forex out by default',
			input: {},
			url: '/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest&excludeAssetClass=Forex+Perps'
		},
		{
			name: 'the overview adds CEX venues once opted in',
			input: { includeCex: true },
			url: '/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest&includeCex=true&excludeAssetClass=Forex+Perps'
		},
		{
			name: 'the overview covers every market once Forex is included',
			input: { includeForex: true },
			url: '/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest'
		},
		{
			name: 'the Forex page scopes to its asset class',
			input: { assetClassFilter: 'Forex Perps' },
			url: '/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest&assetClass=Forex+Perps'
		},
		{
			name: 'the Forex page takes its configured base-asset default',
			input: { assetClassFilter: 'Forex Perps', chartDefaults: { timeSeriesBreakdown: 'baseAsset' } },
			url: '/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=openInterest&assetClass=Forex+Perps'
		},
		{
			name: 'a contract breakdown uses the contract aggregate',
			input: { assetClassFilter: 'Forex Perps', query: { timeSeriesChartBreakdown: 'contract' } },
			url: '/api/public/rwa/perps/contract-breakdown?key=openInterest&assetClass=Forex+Perps'
		},
		{
			name: 'user filters switch to per-market history for the visible rows',
			input: { hasActiveMarketFilters: true },
			url: '/api/public/rwa/perps/market-breakdown?key=openInterest&excludeAssetClass=Forex+Perps'
		},
		{
			name: 'filtered Forex rows project from the DEX market series',
			input: { assetClassFilter: 'Forex Perps', hasActiveMarketFilters: true },
			url: '/api/public/rwa/perps/market-breakdown?key=openInterest&assetClass=Forex+Perps'
		},
		{
			name: 'an asset group page groups its aggregate by base asset',
			input: { mode: 'assetGroup', scopeName: 'Equities' },
			url: '/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=openInterest&assetGroup=Equities'
		},
		{
			name: 'a CEX-only asset page reads per-market history across all venues',
			input: { mode: 'asset', scopeName: 'Meta', includeCex: true, includeCexByDefault: true },
			url: '/api/public/rwa/perps/market-breakdown?key=openInterest&includeCex=true&baseAsset=Meta'
		}
	] satisfies Array<{ name: string; input: Parameters<typeof plan>[0]; url: string }>)(
		'$name',
		({ input, url: expected }) => {
			expect(url(input)).toBe(expected)
		}
	)
})

describe('RWA perps dashboard preloaded history', () => {
	test('shows the server-preloaded default history instead of fetching', () => {
		expect(plan({ initialChartDataset: PRELOADED })).toMatchObject({ useInitialDataset: true, enabled: false })
	})

	test('fetches when nothing was preloaded', () => {
		expect(plan({})).toMatchObject({ useInitialDataset: false, enabled: true })
	})

	test.each([
		{ name: 'Forex is included', input: { includeForex: true } },
		{ name: 'CEX venues are opted in', input: { includeCex: true } },
		{ name: 'user filters are active', input: { hasActiveMarketFilters: true } },
		{ name: 'the metric changes', input: { query: { chartType: 'volume24h' } } }
	])('fetches instead of reusing the no-Forex DEX preload when $name', ({ input }) => {
		expect(plan({ ...input, initialChartDataset: PRELOADED })).toMatchObject({
			useInitialDataset: false,
			enabled: true
		})
	})

	test('fetches nothing for snapshot views', () => {
		expect(plan({ query: { chartView: 'treemap' } }).enabled).toBe(false)
	})
})
