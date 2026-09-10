import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import type { IProtocolMedianApyChart } from '../api.types'
import { protocolCharts } from '../constants'
import type { IProtocolOverviewPageData, IProtocolPageMetrics, IToggledMetrics } from '../types'

type ProbeProps = IProtocolOverviewPageData & {
	toggledMetrics: IToggledMetrics
	groupBy: ChartTimeGroupingWithCumulative
	tvlSettings: Record<string, boolean>
}

type QueryOptions = { queryKey: Array<string | null> }
type TvlChartOptions = {
	protocol: string
	key?: 'pool2' | 'staking' | 'borrowed' | 'vesting'
	enabled: boolean
}
type TvlQueryResult = {
	data: Array<[number, number]> | undefined
	isLoading: boolean
	isError: boolean
}
type QueryHookResult<T> = { data: T | null; isLoading: boolean }

const mocks = vi.hoisted(() => ({
	useQuery: vi.fn(),
	useQueries: vi.fn(),
	useFetchProtocolTVLChart: vi.fn<(options: TvlChartOptions) => TvlQueryResult>(),
	useFetchProtocolMedianAPY: vi.fn((_protocol: string | null): QueryHookResult<IProtocolMedianApyChart> => ({
		data: null,
		isLoading: false
	})),
	isClient: true,
	lastResult: null as ReturnType<typeof import('../useFetchProtocolChartData').useFetchProtocolChartData> | null
}))

vi.mock('@tanstack/react-query', () => ({
	skipToken: Symbol('skipToken'),
	useQuery: mocks.useQuery,
	useQueries: mocks.useQueries
}))

vi.mock('next/router', () => ({
	useRouter: () => ({ isReady: true })
}))

vi.mock('~/hooks/useIsClient', () => ({
	useIsClient: () => mocks.isClient
}))

vi.mock('~/containers/ProtocolOverview/queries.client', () => ({
	useFetchProtocolActivityChart: () => ({ data: null, isLoading: false }),
	useFetchProtocolMedianAPY: mocks.useFetchProtocolMedianAPY,
	useFetchProtocolTVLChart: mocks.useFetchProtocolTVLChart
}))

vi.mock('~/utils/async', () => ({
	fetchJson: vi.fn()
}))

import { useFetchProtocolChartData } from '../useFetchProtocolChartData'

const timestamp = Date.UTC(2024, 0, 1) / 1e3
const timestampMs = Date.UTC(2024, 0, 1)
const DISABLED_TVL_QUERY: TvlQueryResult = { data: undefined, isLoading: false, isError: false }
type TvlQueryKey = 'base' | 'pool2' | 'staking' | 'borrowed' | 'vesting'
let tvlQueryResults: Partial<Record<TvlQueryKey, TvlQueryResult>> = {}

function setTvlQueries(queries: Partial<Record<TvlQueryKey, TvlQueryResult>>) {
	tvlQueryResults = queries
}

function makeToggledMetrics(overrides: Partial<IToggledMetrics>): IToggledMetrics {
	const toggles = {
		events: 'false',
		denomination: null
	} as IToggledMetrics
	for (const queryParam of Object.values(protocolCharts)) {
		toggles[queryParam] = 'false'
	}
	return { ...toggles, ...overrides }
}

const toggledMetrics = makeToggledMetrics({
	fees: 'true',
	revenue: 'true',
	holdersRevenue: 'true'
})

const baseMetrics: IProtocolPageMetrics = {
	tvl: false,
	dexs: false,
	dexsNotionalVolume: false,
	perps: false,
	openInterest: false,
	optionsPremiumVolume: false,
	optionsNotionalVolume: false,
	dexAggregators: false,
	perpsAggregators: false,
	bridgeAggregators: false,
	stablecoins: false,
	bridge: false,
	treasury: false,
	unlocks: false,
	incentives: false,
	yields: false,
	fees: false,
	revenue: false,
	forks: false,
	nfts: false,
	dev: false,
	inflows: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false,
	rwa: false
}

const feeProps: ProbeProps = {
	name: 'Test Protocol',
	id: 'test-protocol',
	token: { symbol: null, gecko_id: null, gecko_url: null, explorer_url: null },
	chains: [],
	geckoId: null,
	currentTvlByChain: null,
	isOracleProtocol: false,
	oracleTvs: null,
	initialMultiSeriesChartData: {},
	metrics: {
		...baseMetrics,
		fees: true,
		revenue: true
	},
	toggledMetrics,
	groupBy: 'daily',
	availableCharts: ['Fees', 'Revenue', 'Holders Revenue'],
	chartDenominations: [],
	chartColors: {},
	tvlSettings: {},
	isCEX: false,
	fees: null,
	revenue: null,
	holdersRevenue: null,
	dexVolume: null,
	dexNotionalVolume: null,
	dexAggregatorVolume: null,
	perpVolume: null,
	openInterest: null,
	perpAggregatorVolume: null,
	bridgeAggregatorVolume: null,
	optionsPremiumVolume: null,
	optionsNotionalVolume: null,
	liquidationVolume: null,
	collateralLiquidated: null,
	bridgeVolume: null,
	treasury: null,
	unlocks: null,
	yields: null,
	articles: null,
	raises: null,
	expenses: null,
	outstandingFDV: null,
	audits: null,
	hacks: [],
	hallmarks: [],
	rangeHallmarks: [],
	seoTitle: 'Test Protocol',
	seoDescription: 'Test Protocol charts',
	defaultToggledCharts: []
}

let probeProps = feeProps

function Probe() {
	mocks.lastResult = useFetchProtocolChartData(probeProps)
	return null
}

describe('ProtocolOverview chart metric semantics', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.isClient = true
		probeProps = feeProps
		tvlQueryResults = {}
		mocks.useFetchProtocolTVLChart.mockImplementation(
			(options) => tvlQueryResults[options.key ?? 'base'] ?? DISABLED_TVL_QUERY
		)
		mocks.useQueries.mockImplementation(({ queries }: { queries: Array<QueryOptions> }) =>
			queries.map((options) => mocks.useQuery(options))
		)
		mocks.useQuery.mockImplementation((options: QueryOptions) => {
			if (options.queryKey[2] === 'fees') return { data: [[timestamp, 100]], isLoading: false }
			if (options.queryKey[2] === 'revenue') return { data: [[timestamp, 50]], isLoading: false }
			if (options.queryKey[2] === 'holders-revenue') return { data: [[timestamp, 25]], isLoading: false }
			return { data: null, isLoading: false }
		})
	})

	test('keeps client-only chart queries disabled during SSR hydration', () => {
		mocks.isClient = false
		probeProps = {
			...feeProps,
			metrics: { ...baseMetrics, perps: true },
			toggledMetrics: makeToggledMetrics({ [protocolCharts['Perp Volume']]: 'true' }),
			availableCharts: ['Perp Volume']
		}

		renderToStaticMarkup(<Probe />)

		const perpVolumeQuery = mocks.useQuery.mock.calls
			.map(([options]) => options)
			.find((options) => options.queryKey[2] === 'perp-volume')
		expect(perpVolumeQuery.enabled).toBe(false)
	})

	test('keeps prefetched chart data visible during SSR hydration', () => {
		mocks.isClient = false
		probeProps = {
			...feeProps,
			initialMultiSeriesChartData: { 'Perp Volume': [[timestamp, 42]] },
			metrics: { ...baseMetrics, perps: true },
			toggledMetrics: makeToggledMetrics({ [protocolCharts['Perp Volume']]: 'true' }),
			availableCharts: ['Perp Volume']
		}

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts['Perp Volume']).toEqual([[timestampMs, 42]])
		expect(mocks.lastResult?.loadingCharts).toEqual([])
	})

	test('creates protocol TVL observers only for the base chart and protocol-valid extra keys', () => {
		probeProps = {
			...feeProps,
			currentTvlByChain: {
				staking: 10,
				borrowed: 20,
				pool2: 30,
				vesting: 40
			},
			metrics: { ...baseMetrics, tvl: true },
			toggledMetrics: makeToggledMetrics({ tvl: 'true' }),
			availableCharts: ['TVL'],
			tvlSettings: {
				staking: true,
				borrowed: true,
				pool2: true,
				vesting: true,
				doublecounted: true,
				liquidstaking: true,
				govtokens: true
			}
		}

		renderToStaticMarkup(<Probe />)

		const observers = mocks.useFetchProtocolTVLChart.mock.calls.map(([options]) => ({
			key: options.key ?? 'base',
			enabled: options.enabled
		}))
		expect(observers).toHaveLength(5)
		expect(observers).toEqual(
			expect.arrayContaining([
				{ key: 'base', enabled: true },
				{ key: 'pool2', enabled: true },
				{ key: 'staking', enabled: true },
				{ key: 'borrowed', enabled: true },
				{ key: 'vesting', enabled: true }
			])
		)
	})

	test('distinguishes a cold extra error from successful empty and cached-error composite TVL data', () => {
		const baseChart: Array<[number, number]> = [
			[timestamp, 100],
			[timestamp + 86_400, 110]
		]
		probeProps = {
			...feeProps,
			currentTvlByChain: { pool2: 1 },
			metrics: { ...baseMetrics, tvl: true, inflows: true },
			toggledMetrics: makeToggledMetrics({ tvl: 'true', usdInflows: 'true' }),
			availableCharts: ['TVL', 'USD Inflows'],
			tvlSettings: { pool2: true }
		}

		setTvlQueries({
			base: { data: baseChart, isLoading: false, isError: false },
			pool2: { data: undefined, isLoading: false, isError: true }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts.TVL).toBeUndefined()
		expect(mocks.lastResult?.finalCharts['USD Inflows']).toBeUndefined()
		expect(mocks.lastResult?.failedMetrics).toEqual(['TVL', 'USD Inflows'])

		setTvlQueries({
			base: { data: baseChart, isLoading: false, isError: false },
			pool2: { data: [], isLoading: false, isError: false }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([
			[timestampMs, 100],
			[timestampMs + 86_400_000, 110]
		])
		expect(mocks.lastResult?.finalCharts['USD Inflows']).toEqual([[timestampMs + 86_400_000, 10]])
		expect(mocks.lastResult?.failedMetrics).toEqual([])

		setTvlQueries({
			base: { data: baseChart, isLoading: false, isError: false },
			pool2: {
				data: [
					[timestamp, 5],
					[timestamp + 86_400, 6]
				],
				isLoading: false,
				isError: true
			}
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([
			[timestampMs, 105],
			[timestampMs + 86_400_000, 116]
		])
		expect(mocks.lastResult?.finalCharts['USD Inflows']).toEqual([[timestampMs + 86_400_000, 11]])
		expect(mocks.lastResult?.failedMetrics).toEqual([])
	})

	test('registers successful empty TVL-family charts without reporting them as failures', () => {
		probeProps = {
			...feeProps,
			currentTvlByChain: { staking: 1, borrowed: 1 },
			metrics: { ...baseMetrics, tvl: true, inflows: true },
			toggledMetrics: makeToggledMetrics({
				tvl: 'true',
				usdInflows: 'true',
				staking_tvl: 'true',
				borrowed_tvl: 'true'
			}),
			availableCharts: ['TVL', 'USD Inflows', 'Staking', 'Active Loans']
		}
		setTvlQueries({
			base: { data: [], isLoading: false, isError: false },
			staking: { data: [], isLoading: false, isError: false },
			borrowed: { data: [], isLoading: false, isError: false }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts.TVL).toEqual([])
		expect(mocks.lastResult?.finalCharts['USD Inflows']).toEqual([])
		expect(mocks.lastResult?.finalCharts.Staking).toEqual([])
		expect(mocks.lastResult?.finalCharts['Active Loans']).toEqual([])
		expect(mocks.lastResult?.failedMetrics).toEqual([])
	})

	test('distinguishes successful empty, cold failure, and retained cached TVS data', () => {
		probeProps = {
			...feeProps,
			toggledMetrics: makeToggledMetrics({ tvs: 'true' }),
			availableCharts: ['TVS']
		}
		mocks.useQuery.mockImplementation((options: QueryOptions) =>
			options.queryKey[2] === 'tvs' ? { data: [], isLoading: false } : { data: null, isLoading: false }
		)

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts.TVS).toEqual([])
		expect(mocks.lastResult?.failedMetrics).toEqual([])

		mocks.useQuery.mockImplementation(() => ({ data: null, isLoading: false }))
		renderToStaticMarkup(<Probe />)
		expect(mocks.lastResult?.finalCharts.TVS).toBeUndefined()
		expect(mocks.lastResult?.failedMetrics).toEqual(['TVS'])

		mocks.useQuery.mockImplementation((options: QueryOptions) =>
			options.queryKey[2] === 'tvs' ? { data: [[timestamp, 42]], isLoading: false } : { data: null, isLoading: false }
		)
		renderToStaticMarkup(<Probe />)
		expect(mocks.lastResult?.finalCharts.TVS).toEqual([[timestampMs, 42]])
		expect(mocks.lastResult?.failedMetrics).toEqual([])
	})

	test('keeps USD Inflows loading while its required composite TVL source loads', () => {
		probeProps = {
			...feeProps,
			metrics: { ...baseMetrics, tvl: true, inflows: true },
			toggledMetrics: makeToggledMetrics({ usdInflows: 'true' }),
			availableCharts: ['TVL', 'USD Inflows']
		}
		setTvlQueries({ base: { data: undefined, isLoading: true, isError: false } })

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.loadingCharts).toEqual(['USD Inflows'])
		expect(mocks.lastResult?.failedMetrics).toEqual([])
	})

	test('keeps primary TVL loading while an enabled composite-only staking source loads', () => {
		probeProps = {
			...feeProps,
			currentTvlByChain: { staking: 1 },
			metrics: { ...baseMetrics, tvl: true },
			toggledMetrics: makeToggledMetrics({ tvl: 'true' }),
			availableCharts: ['TVL'],
			tvlSettings: { staking: true }
		}
		setTvlQueries({
			base: { data: [[timestamp, 100]], isLoading: false, isError: false },
			staking: { data: undefined, isLoading: true, isError: false }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.loadingCharts).toEqual(['TVL'])
		expect(mocks.lastResult?.failedMetrics).toEqual([])
	})

	test('keeps fee-family charts visible from their base queries', () => {
		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts.Fees).toEqual([[timestampMs, 100]])
		expect(mocks.lastResult?.finalCharts.Revenue).toEqual([[timestampMs, 50]])
		expect(mocks.lastResult?.finalCharts['Holders Revenue']).toEqual([[timestampMs, 25]])
		expect(mocks.lastResult?.failedMetrics).toEqual([])
	})

	test('builds FDV chart points by applying token supply to price history', () => {
		probeProps = {
			...feeProps,
			geckoId: 'test-token',
			metrics: baseMetrics,
			toggledMetrics: { fdv: 'true' } as IToggledMetrics,
			availableCharts: ['FDV']
		}

		mocks.useQuery.mockImplementation((options: QueryOptions) => {
			if (options.queryKey[2] === 'token-price-history') {
				return {
					data: {
						prices: [
							[timestampMs, 2],
							[timestampMs + 86_400_000, 3]
						],
						mcaps: [],
						volumes: []
					},
					isLoading: false
				}
			}
			if (options.queryKey[2] === 'token-supply') return { data: 100, isLoading: false }
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts.FDV).toEqual([
			[timestampMs, 200],
			[timestampMs + 86_400_000, 300]
		])
	})

	test('keeps absent optional CoinGecko series unavailable when prices exist', () => {
		probeProps = {
			...feeProps,
			geckoId: 'test-token',
			metrics: baseMetrics,
			toggledMetrics: makeToggledMetrics({ mcap: 'true', tokenPrice: 'true', tokenVolume: 'true' }),
			availableCharts: ['Mcap', 'Token Price', 'Token Volume']
		}

		mocks.useQuery.mockImplementation((options: QueryOptions) => {
			if (options.queryKey[2] === 'token-price-history') {
				return { data: { prices: [[timestampMs, 2]] }, isLoading: false }
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts['Token Price']).toEqual([[timestampMs, 2]])
		expect(mocks.lastResult?.finalCharts.Mcap).toBeUndefined()
		expect(mocks.lastResult?.finalCharts['Token Volume']).toBeUndefined()
		expect(mocks.lastResult?.failedMetrics).toEqual(['Mcap', 'Token Volume'])
	})

	test('fetches descriptor-driven liquidation charts', () => {
		probeProps = {
			...feeProps,
			metrics: { ...baseMetrics, collateralLiquidated: true },
			toggledMetrics: makeToggledMetrics({ collateralLiquidated: 'true' }),
			availableCharts: ['Collateral Liquidated']
		}

		mocks.useQuery.mockImplementation((options: QueryOptions) => {
			if (options.queryKey[2] === 'collateral-liquidated') {
				return { data: [[timestamp, 123]], isLoading: false }
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts['Collateral Liquidated']).toEqual([[timestampMs, 123]])
		expect(mocks.lastResult?.failedMetrics).toEqual([])
	})

	test('preserves numeric median APY without parsing or zero fallback', () => {
		probeProps = {
			...feeProps,
			metrics: { ...baseMetrics, yields: true },
			toggledMetrics: makeToggledMetrics({ medianApy: 'true' }),
			availableCharts: ['Median APY']
		}
		mocks.useFetchProtocolMedianAPY.mockReturnValueOnce({
			data: [{ date: timestamp, medianAPY: -2.5 }],
			isLoading: false
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.finalCharts['Median APY']).toEqual([[timestampMs, -2.5]])
	})

	test('keeps cumulative fee-family charts in selected denomination units', () => {
		const secondTimestamp = timestamp + 86_400
		const secondTimestampMs = timestampMs + 86_400_000
		probeProps = {
			...feeProps,
			groupBy: 'cumulative',
			chartDenominations: [{ symbol: 'ETH', geckoId: 'ethereum' }],
			toggledMetrics: {
				...toggledMetrics,
				denomination: 'ETH'
			}
		}

		mocks.useQuery.mockImplementation((options: QueryOptions) => {
			if (options.queryKey[2] === 'denomination-price-history') {
				return {
					data: {
						[String(timestamp)]: 10,
						[String(secondTimestamp)]: 20
					},
					isLoading: false
				}
			}
			if (options.queryKey[2] === 'fees') {
				return {
					data: [
						[timestamp, 100],
						[secondTimestamp, 200]
					],
					isLoading: false
				}
			}
			if (options.queryKey[2] === 'revenue') {
				return {
					data: [
						[timestamp, 50],
						[secondTimestamp, 100]
					],
					isLoading: false
				}
			}
			if (options.queryKey[2] === 'holders-revenue') {
				return {
					data: [
						[timestamp, 30],
						[secondTimestamp, 40]
					],
					isLoading: false
				}
			}
			return { data: null, isLoading: false }
		})

		renderToStaticMarkup(<Probe />)

		expect(mocks.lastResult?.valueSymbol).toBe('ETH')
		expect(mocks.lastResult?.finalCharts.Fees).toEqual([
			[timestampMs, 10],
			[secondTimestampMs, 20]
		])
		expect(mocks.lastResult?.finalCharts.Revenue).toEqual([
			[timestampMs, 5],
			[secondTimestampMs, 10]
		])
		expect(mocks.lastResult?.finalCharts['Holders Revenue']).toEqual([
			[timestampMs, 3],
			[secondTimestampMs, 5]
		])
	})
})
