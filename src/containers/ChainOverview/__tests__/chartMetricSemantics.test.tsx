import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ChainChartLabels } from '../constants'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	useQuery: vi.fn(),
	skipToken: Symbol('skipToken'),
	lastResult: null as ReturnType<typeof import('../useFetchChainChartData').useFetchChainChartData> | null
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: mocks.useQuery,
	skipToken: mocks.skipToken
}))

vi.mock('~/containers/Bridges/queries.client', () => ({
	useGetBridgeChartDataByChain: () => ({ data: null, isLoading: false })
}))

vi.mock('~/containers/Stablecoins/queries.client', () => ({
	useGetStabelcoinsChartDataByChain: () => ({ data: null, isLoading: false })
}))

vi.mock('~/utils/async', () => ({
	fetchJson: mocks.fetchJson
}))

import { buildDenominationPriceHistory, useFetchChainChartData } from '../useFetchChainChartData'

const feeRevenueChartRows: Array<{ label: ChainChartLabels; expectedUrl: string }> = [
	{
		label: 'Chain Fees',
		expectedUrl: '/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=fees&protocol=Base'
	},
	{
		label: 'Chain Revenue',
		expectedUrl:
			'/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=fees&protocol=Base&dataType=dailyRevenue'
	},
	{
		label: 'App Fees',
		expectedUrl: '/api/public/chains/charts?kind=adapter-chain&adapterType=fees&chain=Base&dataType=dailyAppFees'
	},
	{
		label: 'App Revenue',
		expectedUrl: '/api/public/chains/charts?kind=adapter-chain&adapterType=fees&chain=Base&dataType=dailyAppRevenue'
	}
]

const activityChartRows: Array<{ label: ChainChartLabels; expectedUrl: string }> = [
	{
		label: 'Active Addresses',
		expectedUrl: '/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=active-users&protocol=Base'
	},
	{
		label: 'New Addresses',
		expectedUrl: '/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=new-users&protocol=Base'
	},
	{
		label: 'Transactions',
		expectedUrl:
			'/api/public/chains/charts?kind=adapter-protocol&entity=chain&adapterType=active-users&protocol=Base&dataType=dailyTransactionsCount'
	}
]

function Probe({
	toggledCharts,
	denomination = 'USD',
	chainGeckoId = null,
	gasTokenGeckoId = chainGeckoId,
	tvlChart = []
}: {
	toggledCharts: Array<ChainChartLabels>
	denomination?: string
	chainGeckoId?: string | null
	gasTokenGeckoId?: string | null
	tvlChart?: Array<[number, number]>
}) {
	mocks.lastResult = useFetchChainChartData({
		denomination,
		selectedChain: 'Base',
		tvlChart,
		tvlChartSummary: {
			totalValueUSD: null,
			tvlPrevDay: null,
			valueChange24hUSD: null,
			change24h: null
		},
		extraTvlCharts: {},
		tvlSettings: {},
		chainGeckoId,
		gasTokenGeckoId,
		toggledCharts,
		groupBy: 'daily'
	})

	return null
}

describe('ChainOverview chart metric semantics', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fetchJson.mockResolvedValue([])
		mocks.useQuery.mockImplementation((options: { enabled?: boolean; queryFn: unknown }) => {
			if (options.enabled !== false && typeof options.queryFn === 'function') {
				options.queryFn()
			}
			return { data: null, isLoading: false }
		})
	})

	test.each(feeRevenueChartRows)('builds the current $label chart API URL', ({ label, expectedUrl }) => {
		renderToStaticMarkup(<Probe toggledCharts={[label]} />)

		expect(mocks.fetchJson).toHaveBeenCalledTimes(1)
		expect(mocks.fetchJson).toHaveBeenCalledWith(expectedUrl)
	})

	test.each(activityChartRows)('builds the current $label chart API URL', ({ label, expectedUrl }) => {
		renderToStaticMarkup(<Probe toggledCharts={[label]} />)

		expect(mocks.fetchJson).toHaveBeenCalledTimes(1)
		expect(mocks.fetchJson).toHaveBeenCalledWith(expectedUrl)
	})

	test('uses the chain fee series directly', () => {
		const timestamp = Date.UTC(2024, 0, 1) / 1e3
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'chain-fees') {
				return { data: [[timestamp, 100]], isLoading: false }
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(<Probe toggledCharts={['Chain Fees']} />)

		expect(mocks.lastResult?.finalCharts['Chain Fees']).toEqual([[timestamp * 1e3, 100]])
		expect(mocks.fetchJson).not.toHaveBeenCalled()
	})

	test('keeps USD values and symbols when a requested denomination has no chain gecko id', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		renderToStaticMarkup(
			<Probe toggledCharts={['TVL', 'Token Price']} denomination="ETH" tvlChart={[[timestamp, 2000]]} />
		)

		const priceHistoryQuery = mocks.useQuery.mock.calls
			.map(([options]) => options)
			.find((options) => options.queryKey[1] === 'price-history')
		expect(priceHistoryQuery).toMatchObject({ enabled: false, queryFn: mocks.skipToken })
		expect(mocks.fetchJson).not.toHaveBeenCalled()
		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, 2000]])
		expect(mocks.lastResult?.valueSymbol).toBe('$')
		expect(mocks.lastResult?.failedMetrics).not.toContain('Token Price')
	})

	test('keeps USD values and symbols when the denomination price query fails', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'price-history') {
				return { data: undefined, isLoading: false, error: new Error('price history unavailable') }
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(
			<Probe toggledCharts={['TVL']} denomination="ETH" chainGeckoId="ethereum" tvlChart={[[timestamp, 2000]]} />
		)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, 2000]])
		expect(mocks.lastResult?.valueSymbol).toBe('$')
	})

	test('keeps USD values and symbols when denomination price history is empty', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'price-history') {
				return {
					data: {
						conversionPrices: {},
						canConvert: false,
						priceChart: [],
						mcaps: undefined,
						volumes: undefined
					},
					isLoading: false
				}
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(
			<Probe toggledCharts={['TVL']} denomination="ETH" chainGeckoId="ethereum" tvlChart={[[timestamp, 2000]]} />
		)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, 2000]])
		expect(mocks.lastResult?.valueSymbol).toBe('$')
	})

	test('keeps an all-zero token price chart in USD without enabling denomination conversion', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		const zeroPriceHistory = buildDenominationPriceHistory({ prices: [[timestamp, 0]] })
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'price-history') return { data: zeroPriceHistory, isLoading: false }
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(
			<Probe
				toggledCharts={['TVL', 'Token Price']}
				denomination="ETH"
				chainGeckoId="ethereum"
				tvlChart={[[timestamp, 2000]]}
			/>
		)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, 2000]])
		expect(mocks.lastResult?.finalCharts['Token Price']).toEqual([[timestamp, 0]])
		expect(mocks.lastResult?.valueSymbol).toBe('$')
	})

	test('converts values and exposes the requested symbol when denomination history is usable', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'price-history') {
				return {
					data: {
						conversionPrices: { [timestamp]: 2000 },
						canConvert: true,
						priceChart: [[timestamp, 2000]],
						mcaps: undefined,
						volumes: undefined
					},
					isLoading: false
				}
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(
			<Probe toggledCharts={['TVL']} denomination="ETH" chainGeckoId="ethereum" tvlChart={[[timestamp, 2000]]} />
		)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, 1]])
		expect(mocks.lastResult?.valueSymbol).toBe('ETH')
	})

	test('converts denomination-aware values without converting intrinsically USD series', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'price-history') {
				return {
					data: {
						conversionPrices: { [timestamp]: 2000 },
						canConvert: true,
						priceChart: [[timestamp, 2000]],
						mcaps: [[timestamp, 3000]],
						volumes: [[timestamp, 4000]]
					},
					isLoading: false
				}
			}
			if (options.queryKey[1] === 'raises') return { data: [[timestamp, 5000]], isLoading: false }
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(
			<Probe
				toggledCharts={['TVL', 'Token Price', 'Token Mcap', 'Token Volume', 'Raises']}
				denomination="ETH"
				chainGeckoId="ethereum"
				tvlChart={[[timestamp, 2000]]}
			/>
		)

		expect(mocks.lastResult?.valueSymbol).toBe('ETH')
		expect(mocks.lastResult?.finalCharts).toMatchObject({
			TVL: [[timestamp, 1]],
			'Token Price': [[timestamp, 2000]],
			'Token Mcap': [[timestamp, 3000]],
			'Token Volume': [[timestamp, 4000]],
			Raises: [[timestamp, 5000]]
		})
	})

	test('keeps zero price observations while using only positive dates for conversion', () => {
		const zeroTimestamp = Date.UTC(2024, 0, 1)
		const positiveTimestamp = Date.UTC(2024, 0, 2)
		const priceHistory = buildDenominationPriceHistory({
			prices: [
				[zeroTimestamp, 0],
				[positiveTimestamp, 2000]
			]
		})
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'price-history') return { data: priceHistory, isLoading: false }
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(
			<Probe
				toggledCharts={['TVL', 'Token Price']}
				denomination="ETH"
				chainGeckoId="ethereum"
				tvlChart={[
					[zeroTimestamp, 2000],
					[positiveTimestamp, 2000]
				]}
			/>
		)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([
			[zeroTimestamp, null],
			[positiveTimestamp, 1]
		])
		expect(mocks.lastResult?.finalCharts['Token Price']).toEqual([
			[zeroTimestamp, 0],
			[positiveTimestamp, 2000]
		])
		expect(mocks.lastResult?.valueSymbol).toBe('ETH')
	})

	test('keeps null gaps for dates missing from otherwise usable denomination history', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		const otherTimestamp = Date.UTC(2024, 0, 2)
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] === 'price-history') {
				return {
					data: {
						conversionPrices: { [otherTimestamp]: 2000 },
						canConvert: true,
						priceChart: [[otherTimestamp, 2000]],
						mcaps: undefined,
						volumes: undefined
					},
					isLoading: false
				}
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(
			<Probe toggledCharts={['TVL']} denomination="ETH" chainGeckoId="ethereum" tvlChart={[[timestamp, 2000]]} />
		)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, null]])
		expect(mocks.lastResult?.valueSymbol).toBe('ETH')
	})
	test('uses ETH for conversion and ARB for all official token series', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		mocks.useQuery.mockImplementation((options: { queryKey: Array<unknown> }) => {
			if (options.queryKey[1] !== 'price-history') return { data: null, isLoading: false }
			const data =
				options.queryKey[2] === 'ethereum'
					? buildDenominationPriceHistory({
							prices: [[timestamp, 2000]],
							mcaps: [[timestamp, 99_999]],
							volumes: [[timestamp, 88_888]]
						})
					: buildDenominationPriceHistory({
							prices: [[timestamp, 2]],
							mcaps: [[timestamp, 300]],
							volumes: [[timestamp, 400]]
						})
			return { data, isLoading: false }
		})
		renderToStaticMarkup(
			<Probe
				denomination="ETH"
				chainGeckoId="arbitrum"
				gasTokenGeckoId="ethereum"
				toggledCharts={['TVL', 'Token Price', 'Token Mcap', 'Token Volume']}
				tvlChart={[[timestamp, 4000]]}
			/>
		)
		expect(mocks.lastResult?.valueSymbol).toBe('ETH')
		expect(mocks.lastResult?.finalCharts).toMatchObject({
			TVL: [[timestamp, 2]],
			'Token Price': [[timestamp, 2]],
			'Token Mcap': [[timestamp, 300]],
			'Token Volume': [[timestamp, 400]]
		})
	})

	test('converts a tokenless chain without creating gas-token valuation charts', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		mocks.useQuery.mockImplementation((options: { enabled: boolean; queryKey: Array<unknown> }) => ({
			data:
				options.enabled && options.queryKey[1] === 'price-history'
					? buildDenominationPriceHistory({ prices: [[timestamp, 2000]] })
					: null,
			isLoading: false
		}))
		renderToStaticMarkup(
			<Probe
				denomination="ETH"
				chainGeckoId={null}
				gasTokenGeckoId="ethereum"
				toggledCharts={['TVL', 'Token Price']}
				tvlChart={[[timestamp, 4000]]}
			/>
		)
		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, 2]])
		expect(mocks.lastResult?.finalCharts['Token Price']).toBeUndefined()
	})

	test('keeps official valuation available when gas mapping is absent', () => {
		const timestamp = Date.UTC(2024, 0, 1)
		mocks.useQuery.mockImplementation((options: { enabled: boolean; queryKey: Array<unknown> }) => ({
			data:
				options.enabled && options.queryKey[1] === 'price-history'
					? buildDenominationPriceHistory({ prices: [[timestamp, 2]] })
					: null,
			isLoading: false
		}))
		renderToStaticMarkup(
			<Probe
				denomination="ETH"
				chainGeckoId="arbitrum"
				gasTokenGeckoId={null}
				toggledCharts={['TVL', 'Token Price']}
				tvlChart={[[timestamp, 4000]]}
			/>
		)
		expect(mocks.lastResult?.valueSymbol).toBe('$')
		expect(mocks.lastResult?.finalCharts.TVL).toEqual([[timestamp, 4000]])
		expect(mocks.lastResult?.finalCharts['Token Price']).toEqual([[timestamp, 2]])
	})
})
