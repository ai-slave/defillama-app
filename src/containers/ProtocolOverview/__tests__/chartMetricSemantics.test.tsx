// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { protocolCharts } from '../constants'
import type { IProtocolOverviewPageData, IProtocolPageMetrics, IToggledMetrics } from '../types'
import { useFetchProtocolChartData } from '../useFetchProtocolChartData'

vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true }) }))

type ProbeProps = IProtocolOverviewPageData & {
	toggledMetrics: IToggledMetrics
	groupBy: ChartTimeGroupingWithCumulative
	tvlSettings: Record<string, boolean>
}
type HookResult = ReturnType<typeof useFetchProtocolChartData>

const http = installFixtureFetch()
const timestamp = Date.UTC(2024, 0, 1) / 1e3
const timestampMs = Date.UTC(2024, 0, 1)
const DAY = 86_400

/**
 * Chart API responses keyed by query string. A request for a chart without a response fails the
 * test; `pending` never answers, which keeps that chart loading.
 */
const pending = Symbol('pending')
let chartResponses: Record<string, unknown> = {}
let missing: Array<string> = []

function makeToggledMetrics(overrides: Partial<IToggledMetrics>): IToggledMetrics {
	const toggles = { events: 'false', denomination: null } as IToggledMetrics
	for (const queryParam of Object.values(protocolCharts)) toggles[queryParam] = 'false'
	return { ...toggles, ...overrides }
}

const toggledMetrics = makeToggledMetrics({ fees: 'true', revenue: 'true', holdersRevenue: 'true' })

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
	name: 'Test',
	id: 'test',
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
	generatedAtSec: 1_700_000_000,
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

let client: QueryClient
let root: Root
let container: HTMLDivElement
let result: HookResult | null

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	chartResponses = {}
	missing = []
	result = null
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	const answer = (url: URL) => {
		const response = chartResponses[url.search.slice(1)]
		if (response === pending) return new Promise(() => {})
		if (response === undefined) {
			missing.push(url.search)
			return new Response(null, { status: 404 })
		}
		return response
	}
	http.serve({
		'/api/public/protocols/charts': answer,
		'http://localhost:3000/api/public/tokens/charts/coingecko/': answer
	})
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	if (missing.length > 0) throw new Error(`Chart requests without a response: ${missing.join(', ')}`)
})

function Probe(props: ProbeProps) {
	result = useFetchProtocolChartData(props)
	return null
}

async function mount(props: ProbeProps) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Probe {...props} />
			</QueryClientProvider>
		)
	)
}

// Lets fetches resolve inside act, so their renders are flushed, until the assertion holds.
function until(assertion: () => void) {
	return waitForUi(async () => {
		await act(() => new Promise((resolve) => setTimeout(resolve, 5)))
		assertion()
	})
}

// Waits until no chart is loading, so each assertion sees settled data.
async function settle(props: ProbeProps) {
	await mount(props)
	await until(() => expect(result?.loadingCharts).toEqual([]))
	return result!
}

const tvl = (query = '') => `kind=tvl&protocol=test${query}`
const adapter = (adapterType: string, dataType?: string) =>
	`kind=adapter&adapterType=${adapterType}&protocol=Test${dataType ? `&dataType=${dataType}` : ''}`

const tvlProps = (overrides: Partial<ProbeProps>): ProbeProps => ({
	...feeProps,
	metrics: { ...baseMetrics, tvl: true },
	toggledMetrics: makeToggledMetrics({ tvl: 'true' }),
	availableCharts: ['TVL'],
	...overrides
})

describe('server render', () => {
	test('shows prefetched charts and requests nothing before hydration', () => {
		let serverResult: HookResult | null = null
		function ServerProbe() {
			serverResult = useFetchProtocolChartData({
				...feeProps,
				initialMultiSeriesChartData: { 'Perp Volume': [[timestamp, 42]] },
				metrics: { ...baseMetrics, perps: true },
				toggledMetrics: makeToggledMetrics({ [protocolCharts['Perp Volume']]: 'true' }),
				availableCharts: ['Perp Volume']
			})
			return null
		}
		renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<ServerProbe />
			</QueryClientProvider>
		)
		expect(serverResult!.finalCharts['Perp Volume']).toEqual([[timestampMs, 42]])
		expect(serverResult!.loadingCharts).toEqual([])
		expect(http.requests).toEqual([])
	})
})

describe('TVL', () => {
	const baseChart: Array<[number, number]> = [
		[timestamp, 100],
		[timestamp + DAY, 110]
	]

	test('requests the base chart and only the extra keys the protocol reports', async () => {
		chartResponses = {
			[tvl()]: baseChart,
			[tvl('&key=staking')]: [],
			[tvl('&key=borrowed')]: [],
			[tvl('&key=pool2')]: []
		}
		await settle(
			tvlProps({
				currentTvlByChain: { staking: 10, borrowed: 20, pool2: 30 },
				tvlSettings: { staking: true, borrowed: true, pool2: true, vesting: true, doublecounted: true }
			})
		)
		expect(http.requests.map(({ url }) => url.searchParams.get('key') ?? 'base').toSorted()).toEqual([
			'base',
			'borrowed',
			'pool2',
			'staking'
		])
	})

	test('reports TVL and USD inflows as failed when a required extra fails before returning data', async () => {
		chartResponses = { [tvl()]: baseChart }
		missing = []
		const settled = await settle(
			tvlProps({
				currentTvlByChain: { pool2: 1 },
				metrics: { ...baseMetrics, tvl: true, inflows: true },
				toggledMetrics: makeToggledMetrics({ tvl: 'true', usdInflows: 'true' }),
				availableCharts: ['TVL', 'USD Inflows'],
				tvlSettings: { pool2: true }
			})
		)
		expect(settled.finalCharts).toEqual({})
		expect(settled.failedMetrics).toEqual(['TVL', 'USD Inflows'])
		expect(missing).toEqual(['?kind=tvl&protocol=test&key=pool2'])
		missing = []
	})

	test('adds a successful extra, empty or not, and keeps it through a failed refetch', async () => {
		const props = tvlProps({
			currentTvlByChain: { pool2: 1 },
			metrics: { ...baseMetrics, tvl: true, inflows: true },
			toggledMetrics: makeToggledMetrics({ tvl: 'true', usdInflows: 'true' }),
			availableCharts: ['TVL', 'USD Inflows'],
			tvlSettings: { pool2: true }
		})
		chartResponses = { [tvl()]: baseChart, [tvl('&key=pool2')]: [] }
		expect(await settle(props)).toMatchObject({
			finalCharts: {
				TVL: [
					[timestampMs, 100],
					[timestampMs + DAY * 1e3, 110]
				],
				'USD Inflows': [[timestampMs + DAY * 1e3, 10]]
			},
			failedMetrics: []
		})

		client.clear()
		chartResponses[tvl('&key=pool2')] = [
			[timestamp, 5],
			[timestamp + DAY, 6]
		]
		await settle(props)
		await until(() => expect(result!.finalCharts['USD Inflows']).toEqual([[timestampMs + DAY * 1e3, 11]]))

		delete chartResponses[tvl('&key=pool2')]
		await act(async () => client.refetchQueries())
		// Query observers are notified on a later tick; wait for the failed refetch to render first.
		await until(() =>
			expect(client.getQueryCache().findAll({ predicate: (query) => query.state.status === 'error' })).toHaveLength(1)
		)
		await act(() => new Promise((resolve) => setTimeout(resolve, 5)))
		expect(missing).toEqual(['?kind=tvl&protocol=test&key=pool2'])
		expect(result!.finalCharts.TVL).toEqual([
			[timestampMs, 105],
			[timestampMs + DAY * 1e3, 116]
		])
		expect(result!.failedMetrics).toEqual([])
		missing = []
	})

	test('shows successful empty TVL-family charts without reporting failures', async () => {
		chartResponses = { [tvl()]: [], [tvl('&key=staking')]: [], [tvl('&key=borrowed')]: [] }
		const settled = await settle(
			tvlProps({
				currentTvlByChain: { staking: 1, borrowed: 1 },
				metrics: { ...baseMetrics, tvl: true, inflows: true },
				toggledMetrics: makeToggledMetrics({
					tvl: 'true',
					usdInflows: 'true',
					staking_tvl: 'true',
					borrowed_tvl: 'true'
				}),
				availableCharts: ['TVL', 'USD Inflows', 'Staking', 'Active Loans']
			})
		)
		expect(settled.finalCharts).toEqual({ TVL: [], 'USD Inflows': [], Staking: [], 'Active Loans': [] })
		expect(settled.failedMetrics).toEqual([])
	})

	test('keeps TVL and USD inflows loading while a required source loads', async () => {
		chartResponses = { [tvl()]: pending }
		await mount(
			tvlProps({
				metrics: { ...baseMetrics, tvl: true, inflows: true },
				toggledMetrics: makeToggledMetrics({ usdInflows: 'true' }),
				availableCharts: ['TVL', 'USD Inflows']
			})
		)
		expect(result!.loadingCharts).toEqual(['USD Inflows'])
		expect(result!.failedMetrics).toEqual([])

		await act(async () => root.unmount())
		root = createRoot(container)
		client.clear()
		chartResponses = { [tvl('&key=staking')]: pending }
		await mount(
			tvlProps({
				initialMultiSeriesChartData: { TVL: [[timestamp, 100]] },
				currentTvlByChain: { staking: 1 },
				tvlSettings: { staking: true }
			})
		)
		expect(result!.loadingCharts).toEqual(['TVL'])
		expect(result!.failedMetrics).toEqual([])
	})
})

test('distinguishes a successful empty TVS chart from a failed one', async () => {
	const props = {
		...feeProps,
		toggledMetrics: makeToggledMetrics({ tvs: 'true' }),
		availableCharts: ['TVS']
	} as ProbeProps
	chartResponses = { 'kind=oracle-chart&protocol=Test': [] }
	expect(await settle(props)).toMatchObject({ finalCharts: { TVS: [] }, failedMetrics: [] })

	client.clear()
	chartResponses = {}
	await settle(props)
	await until(() => expect(result!.failedMetrics).toEqual(['TVS']))
	expect(result!.finalCharts).toEqual({})
	missing = []
})

test('shows fee-family charts from their adapter charts', async () => {
	chartResponses = {
		[adapter('fees')]: [[timestamp, 100]],
		[adapter('fees', 'dailyRevenue')]: [[timestamp, 50]],
		[adapter('fees', 'dailyHoldersRevenue')]: [[timestamp, 25]]
	}
	const settled = await settle(feeProps)
	expect(settled.finalCharts).toEqual({
		Fees: [[timestampMs, 100]],
		Revenue: [[timestampMs, 50]],
		'Holders Revenue': [[timestampMs, 25]]
	})
	expect(settled.failedMetrics).toEqual([])
})

test('converts cumulative fee-family charts into the selected denomination', async () => {
	chartResponses = {
		'timeframe=MAX': {
			data: {
				prices: [
					[timestampMs, 10],
					[timestampMs + DAY * 1e3, 20]
				]
			}
		},
		[adapter('fees')]: [
			[timestamp, 100],
			[timestamp + DAY, 200]
		],
		[adapter('fees', 'dailyRevenue')]: [
			[timestamp, 50],
			[timestamp + DAY, 100]
		],
		[adapter('fees', 'dailyHoldersRevenue')]: [
			[timestamp, 30],
			[timestamp + DAY, 40]
		]
	}
	await settle({
		...feeProps,
		groupBy: 'cumulative',
		chartDenominations: [{ symbol: 'ETH', geckoId: 'ethereum' }],
		toggledMetrics: { ...feeProps.toggledMetrics, denomination: 'ETH' }
	})
	await until(() => expect(result!.valueSymbol).toBe('ETH'))
	expect(result!.finalCharts).toEqual({
		Fees: [
			[timestampMs, 10],
			[timestampMs + DAY * 1e3, 20]
		],
		Revenue: [
			[timestampMs, 5],
			[timestampMs + DAY * 1e3, 10]
		],
		'Holders Revenue': [
			[timestampMs, 3],
			[timestampMs + DAY * 1e3, 5]
		]
	})
})

describe('token charts', () => {
	test('builds FDV by applying the token supply to its price history', async () => {
		chartResponses = {
			'timeframe=MAX': {
				data: {
					prices: [
						[timestampMs, 2],
						[timestampMs + DAY * 1e3, 3]
					],
					mcaps: [],
					volumes: []
				}
			},
			'kind=supply': { totalSupply: 100 }
		}
		const settled = await settle({
			...feeProps,
			geckoId: 'test-token',
			metrics: baseMetrics,
			toggledMetrics: makeToggledMetrics({ fdv: 'true' }),
			availableCharts: ['FDV']
		})
		expect(settled.finalCharts.FDV).toEqual([
			[timestampMs, 200],
			[timestampMs + DAY * 1e3, 300]
		])
	})

	test('reports token series CoinGecko omits as failed while prices show', async () => {
		chartResponses = { 'timeframe=MAX': { data: { prices: [[timestampMs, 2]] } } }
		const settled = await settle({
			...feeProps,
			geckoId: 'test-token',
			metrics: baseMetrics,
			toggledMetrics: makeToggledMetrics({ mcap: 'true', tokenPrice: 'true', tokenVolume: 'true' }),
			availableCharts: ['Mcap', 'Token Price', 'Token Volume']
		})
		expect(settled.finalCharts).toEqual({ 'Token Price': [[timestampMs, 2]] })
		expect(settled.failedMetrics).toEqual(['Mcap', 'Token Volume'])
	})
})

test('shows descriptor-driven liquidation charts', async () => {
	chartResponses = { [adapter('liquidations', 'dailyCollateralLiquidated')]: [[timestamp, 123]] }
	const settled = await settle({
		...feeProps,
		metrics: { ...baseMetrics, collateralLiquidated: true },
		toggledMetrics: makeToggledMetrics({ collateralLiquidated: 'true' }),
		availableCharts: ['Collateral Liquidated']
	})
	expect(settled.finalCharts).toEqual({ 'Collateral Liquidated': [[timestampMs, 123]] })
	expect(settled.failedMetrics).toEqual([])
})

test('keeps a negative median APY as reported', async () => {
	chartResponses = { 'kind=median-apy&protocol=test': [{ date: timestamp, medianAPY: -2.5 }] }
	const settled = await settle({
		...feeProps,
		metrics: { ...baseMetrics, yields: true },
		toggledMetrics: makeToggledMetrics({ medianApy: 'true' }),
		availableCharts: ['Median APY']
	})
	expect(settled.finalCharts['Median APY']).toEqual([[timestampMs, -2.5]])
})

describe('active addresses', () => {
	// Mon Sep 14, 2026 to Mon Sep 21: a full week, then the next week's first day.
	const day = (offset: number) => Date.UTC(2026, 8, 14 + offset) / 1e3
	const activeAddresses: Array<[number, number]> = [
		[day(0), 90],
		// Sep 15 has no observation; Sep 16 is a real zero.
		[day(2), 0],
		[day(3), 30],
		[day(7), 50]
	]

	async function activityCharts(groupBy: ChartTimeGroupingWithCumulative) {
		client.clear()
		chartResponses = {
			[adapter('active-users')]: activeAddresses,
			[adapter('new-users')]: activeAddresses.map(([observedAt]) => [observedAt, 10])
		}
		return (
			await settle({
				...feeProps,
				metrics: { ...baseMetrics, activeUsers: true, newUsers: true },
				toggledMetrics: makeToggledMetrics({ activeAddresses: 'true', newAddresses: 'true' }),
				availableCharts: ['Active Addresses', 'New Addresses'],
				groupBy
			})
		).finalCharts
	}

	test('averages the observed days of each period, while new addresses still sum', async () => {
		expect(await activityCharts('weekly')).toEqual({
			'Active Addresses': [
				[Date.UTC(2026, 8, 20), 40],
				[Date.UTC(2026, 8, 27), 50]
			],
			'New Addresses': [
				[Date.UTC(2026, 8, 20), 30],
				[Date.UTC(2026, 8, 27), 10]
			]
		})
	})

	test('leaves active addresses out of a cumulative chart and keeps daily values as they are', async () => {
		const cumulative = await activityCharts('cumulative')
		expect(cumulative['Active Addresses']).toBeUndefined()
		expect(cumulative['New Addresses']).toEqual([
			[day(0) * 1e3, 10],
			[day(2) * 1e3, 20],
			[day(3) * 1e3, 30],
			[day(7) * 1e3, 40]
		])
		expect((await activityCharts('daily'))['Active Addresses']).toEqual(
			activeAddresses.map(([observedAt, value]) => [observedAt * 1e3, value])
		)
	})
})
