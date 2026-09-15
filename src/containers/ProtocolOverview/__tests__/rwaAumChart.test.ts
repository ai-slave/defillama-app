import { describe, expect, test, vi } from 'vitest'
import { buildAvailableCharts, buildDefaultToggledCharts } from '~/containers/ProtocolOverview/defaultCharts'
import { getProtocolPrimaryMetricOverride } from '~/containers/ProtocolOverview/primaryMetricOverrides'

const noCharts = {
	isCEX: false,
	hasTvlChart: false,
	hasRwaAum: false,
	hasTvsChart: false,
	hasGeckoId: false,
	hasLiquidity: false,
	hasFees: false,
	hasRevenue: false,
	hasHoldersRevenue: false,
	hasDexVolume: false,
	hasDexNotionalVolume: false,
	hasPerpVolume: false,
	hasOpenInterest: false,
	hasOptionsPremiumVolume: false,
	hasOptionsNotionalVolume: false,
	hasDexAggregatorVolume: false,
	hasPerpAggregatorVolume: false,
	hasBridgeAggregatorVolume: false,
	hasLiquidationVolume: false,
	hasCollateralLiquidated: false,
	hasBridgeVolume: false,
	hasUnlocks: false,
	hasIncentives: false,
	hasStaking: false,
	hasBorrowed: false,
	hasUsdInflows: false,
	hasTreasury: false,
	hasMedianApy: false,
	hasGovernance: false,
	hasActiveAddresses: false,
	hasNewAddresses: false,
	hasTransactions: false,
	hasGasUsed: false
}

describe('RWA AUM chart', () => {
	test('offers the chart when the platform has an AUM series', () => {
		expect(buildAvailableCharts({ ...noCharts, hasRwaAum: true })).toContain('RWA AUM')
		expect(buildAvailableCharts(noCharts)).not.toContain('RWA AUM')
	})

	test('turns on by default when the TVL adapter has been retired', () => {
		// module: "dummy.js" upstream => no tvl metric => the chart panel would otherwise be empty.
		expect(
			buildDefaultToggledCharts({
				isCEX: false,
				isOracleProtocol: false,
				protocolMetricsTvl: false,
				protocolTvlChartData: [],
				availableCharts: ['RWA AUM']
			})
		).toEqual(['RWA AUM'])
	})

	test('leaves TVL as the default while the adapter is still live', () => {
		const toggled = buildDefaultToggledCharts({
			isCEX: false,
			isOracleProtocol: false,
			protocolMetricsTvl: true,
			protocolTvlChartData: [
				[1, 100],
				[2, 200]
			],
			availableCharts: ['TVL', 'RWA AUM']
		})
		expect(toggled).toContain('TVL')
		expect(toggled).not.toContain('RWA AUM')
	})
})

describe('RWA AUM as the headline metric', () => {
	test('replaces the primary metric when the protocol has platform AUM', () => {
		expect(
			getProtocolPrimaryMetricOverride({ metrics: { tvl: false }, name: 'xStocks', rwaActiveAum: 810_544_611 })
		).toMatchObject({
			source: 'rwaActiveAum',
			// Same words as the chart it plots, so one page never names the number twice.
			title: 'RWA AUM',
			value: 810_544_611
		})
	})

	test('keeps live TVL as the headline even when its current value is zero', () => {
		const protocol = { name: 'xStocks', metrics: { tvl: true }, tvl: 0, rwaActiveAum: 1000 }
		expect(getProtocolPrimaryMetricOverride(protocol)).toBeNull()
	})

	test('leaves protocols without platform AUM alone', () => {
		expect(getProtocolPrimaryMetricOverride({ metrics: { tvl: false }, name: 'xStocks' })).toBeNull()
		expect(
			getProtocolPrimaryMetricOverride({ metrics: { tvl: false }, name: 'xStocks', rwaActiveAum: null })
		).toBeNull()
	})

	test('does not shadow the existing curated override', () => {
		expect(
			getProtocolPrimaryMetricOverride({
				metrics: { tvl: false },
				name: 'Stablejack',
				rwaActiveAum: 2000,
				perpVolume: { total30d: 1000, chainBreakdown: {} } as never
			})
		).toMatchObject({ source: 'perpVolume' })
	})
})

describe('platform AUM series', () => {
	test('propagates upstream failure instead of returning empty history', async () => {
		const { fetchRWAPlatformAumChart } = await import('~/containers/RWA/api')
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('upstream unavailable'))
		try {
			await expect(fetchRWAPlatformAumChart('xstocks')).rejects.toThrow('upstream unavailable')
		} finally {
			fetchSpy.mockRestore()
		}
	})

	// Breakdown rows are keyed by platform display name, alongside every other platform.
	const breakdownRows = [
		{ timestamp: 1_630_713_600, xStocks: 0, Ondo: 10 },
		{ timestamp: 1_630_800_000, xStocks: 0, Ondo: 20 },
		{ timestamp: 1_749_772_800, xStocks: 126, Ondo: 30 },
		{ timestamp: 1_749_859_200, xStocks: 0, Ondo: 40 },
		{ timestamp: 1_749_945_600, xStocks: 500, Ondo: 50 }
	]

	function mockBreakdown(rows: Array<Record<string, number>>) {
		return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'application/json' }),
			json: async () => rows,
			text: async () => JSON.stringify(rows)
		} as unknown as Response)
	}

	test('picks the platform column by slug and drops the leading zero run', async () => {
		const { fetchRWAPlatformAumChart } = await import('~/containers/RWA/api')
		const fetchSpy = mockBreakdown(breakdownRows)

		// Zeros before the first real value go; a zero *inside* the history is a real reading and stays.
		await expect(fetchRWAPlatformAumChart('xstocks')).resolves.toEqual([
			[1_749_772_800, 126],
			[1_749_859_200, 0],
			[1_749_945_600, 500]
		])
		fetchSpy.mockRestore()
	})

	test('reads activeMcap with governance excluded and stablecoins kept', async () => {
		const { fetchRWAPlatformAumChart } = await import('~/containers/RWA/api')
		const fetchSpy = mockBreakdown(breakdownRows)

		await fetchRWAPlatformAumChart('xstocks')

		const url = String(fetchSpy.mock.calls[0]?.[0])
		expect(url).toContain('/chart/platform-breakdown')
		// A governance-inclusive series would headline Ondo's ONDO token as platform AUM.
		expect(url).toContain('key=activeMcap')
		expect(url).toContain('includeStablecoin=true')
		expect(url).not.toContain('includeGovernance')
		fetchSpy.mockRestore()
	})

	test('returns nothing when the platform has no column', async () => {
		const { fetchRWAPlatformAumChart } = await import('~/containers/RWA/api')
		const fetchSpy = mockBreakdown(breakdownRows)

		await expect(fetchRWAPlatformAumChart('not-a-platform')).resolves.toEqual([])
		fetchSpy.mockRestore()
	})
})
