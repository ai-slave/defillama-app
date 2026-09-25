import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import type { PeggedChainsPageData } from '../types'
import type { IFormattedStablecoinChainRow } from '../utils'

const store = vi.hoisted(() => new Map<string, unknown>())
vi.mock('~/utils/cache-client', () => ({
	getObjectCache: async (key: string) => store.get(key) ?? null,
	setObjectCache: async (key: string, value: unknown) => {
		store.set(key, structuredClone(value))
	}
}))

const http = installFixtureFetch()

const NOW = Date.parse('2026-07-22T12:00:00Z')
const timestamp = (daysAgo: number) => String(Math.floor(NOW / 1e3) - daysAgo * 86_400)
const ethereumHistory = [
	{ date: timestamp(30), totalCirculatingUSD: { peggedUSD: 70 } },
	{ date: timestamp(7), totalCirculatingUSD: { peggedUSD: 80 } },
	{ date: timestamp(1), totalCirculatingUSD: { peggedUSD: 90 } },
	{ date: timestamp(0), totalCirculatingUSD: { peggedUSD: 100 } }
]
const arbitrumHistory = [
	{ date: timestamp(30), totalCirculatingUSD: { peggedUSD: 35 } },
	{ date: timestamp(7), totalCirculatingUSD: { peggedUSD: 40 } },
	{ date: timestamp(1), totalCirculatingUSD: { peggedUSD: 45 } },
	{ date: timestamp(0), totalCirculatingUSD: { peggedUSD: 50 } }
]
const aggregateHistory = [
	{ date: timestamp(30), totalCirculatingUSD: { peggedUSD: 105 } },
	{ date: timestamp(7), totalCirculatingUSD: { peggedUSD: 120 } },
	{ date: timestamp(1), totalCirculatingUSD: { peggedUSD: 135 } },
	{ date: timestamp(0), totalCirculatingUSD: { peggedUSD: 150 } }
]
const asset = {
	id: 'asset',
	name: 'Stablecoin',
	symbol: 'STABLE',
	gecko_id: null,
	chains: ['Ethereum', 'Arbitrum'],
	pegType: 'peggedUSD',
	pegMechanism: 'fiat-backed',
	price: 1,
	circulating: { peggedUSD: 150 },
	circulatingPrevDay: { peggedUSD: 135 },
	circulatingPrevWeek: { peggedUSD: 120 },
	circulatingPrevMonth: { peggedUSD: 105 },
	chainCirculating: {}
}
const chains = [
	{ name: 'Ethereum', totalCirculatingUSD: { peggedUSD: 80 } },
	{ name: 'Arbitrum', totalCirculatingUSD: { peggedUSD: 60 } }
]
const dominance = {
	dominanceMap: {
		Ethereum: [
			{
				date: timestamp(0),
				totalCirculatingUSD: { peggedUSD: 100 },
				greatestMcap: { gecko_id: 'usd-coin', symbol: 'USDC', mcap: 80 }
			}
		]
	},
	chainChartMap: { Ethereum: ethereumHistory, Arbitrum: arbitrumHistory }
}

const ASSETS = '/stablecoins'
const CONFIG = '/config'
const AGGREGATE = '/stablecoincharts2/all'
const DOMINANCE = '/stablecoincharts2/all-dominance-chain-breakdown'

const serveUpstreams = () =>
	http.serve({
		[ASSETS]: { peggedAssets: [asset], chains },
		[CONFIG]: { chainCoingeckoIds: {} },
		[AGGREGATE]: { aggregated: aggregateHistory, breakdown: { asset: aggregateHistory }, doublecountedIds: [] },
		[DOMINANCE]: dominance
	})

// 404 fails without the retry backoff a 5xx would wait through.
const failUpstreams = () =>
	http.serve({
		[ASSETS]: fixtureStatus(404),
		[CONFIG]: fixtureStatus(404),
		[AGGREGATE]: fixtureStatus(404),
		[DOMINANCE]: fixtureStatus(404)
	})

// A fresh module instance per load, so the in-process result cache cannot hide the object cache.
const load = async () => {
	vi.resetModules()
	return import('../queries.server')
}

beforeEach(() => {
	store.clear()
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
	vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe('stablecoin chain caches', () => {
	test('the headline excludes double-counted assets', async () => {
		const doubleHistory = aggregateHistory.map((point) => ({ ...point, totalCirculatingUSD: { peggedUSD: 50 } }))
		http.serve({
			[ASSETS]: { peggedAssets: [asset, { ...asset, id: 'double', name: 'Double', symbol: 'DOUBLE' }], chains },
			[CONFIG]: { chainCoingeckoIds: {} },
			[AGGREGATE]: {
				aggregated: aggregateHistory.map((point) => ({
					...point,
					totalCirculatingUSD: { peggedUSD: point.totalCirculatingUSD.peggedUSD + 50 }
				})),
				breakdown: { asset: aggregateHistory, double: doubleHistory },
				doublecountedIds: ['double']
			},
			[DOMINANCE]: dominance
		})
		const { getStablecoinChainsPageData } = await load()

		const page = await getStablecoinChainsPageData()

		expect(page.totalMcapCurrent).toBe(150)
		expect(page.change1d).toBe('+11.11')
	})

	test('the chain market cap chart plots each chain history on its own column', async () => {
		serveUpstreams()
		const { getStablecoinChainsChartSeries } = await load()

		const series = await getStablecoinChainsChartSeries('chainMcaps', false, 10)

		expect(series.dataset).toEqual({
			dimensions: ['timestamp', 'Ethereum', 'Arbitrum'],
			source: [
				[Number(timestamp(30)) * 1e3, 70, 35],
				[Number(timestamp(7)) * 1e3, 80, 40],
				[Number(timestamp(1)) * 1e3, 90, 45],
				[Number(timestamp(0)) * 1e3, 100, 50]
			]
		})
	})

	test('with every upstream down, the page and the chart are served from their stored entries', async () => {
		serveUpstreams()
		const first = await load()
		const page = await first.getStablecoinChainsPageData()
		const chart = await first.getStablecoinChainsChartSeries('totalMcap')

		failUpstreams()
		const next = await load()

		await expect(next.getStablecoinChainsPageData()).resolves.toEqual(page)
		await expect(next.getStablecoinChainsChartSeries('totalMcap')).resolves.toEqual(chart)
	})

	test('a stored page served days later during an outage drops its changes and is flagged stale', async () => {
		serveUpstreams()
		await (await load()).getStablecoinChainsPageData()

		vi.setSystemTime(NOW + 3 * 86_400_000)
		failUpstreams()
		const page = await (await load()).getStablecoinChainsPageData()

		expect(page).toMatchObject({ isDataStale: true, change1d: null, change7d: null, totalMcapCurrent: 150 })
		expect(page.chainCirculatings.map((chain) => [chain.name, chain.change_1d])).toEqual([
			['Ethereum', null],
			['Arbitrum', null]
		])
	})
})

const row = (name: string, overrides: Partial<IFormattedStablecoinChainRow> = {}): IFormattedStablecoinChainRow => ({
	name,
	circulating: 100,
	mcap: 100,
	unreleased: 0,
	bridgedTo: 0,
	minted: 0,
	mcapPrevDay: 90,
	mcapPrevWeek: 80,
	mcapPrevMonth: 70,
	change_1d: 11.11,
	change_7d: 25,
	change_1m: 42.86,
	dominance: null,
	...overrides
})

const clearedDeltas = {
	mcapPrevDay: null,
	mcapPrevWeek: null,
	mcapPrevMonth: null,
	change_1d: null,
	change_7d: null,
	change_1m: null
}

const pageData = (overrides: Partial<PeggedChainsPageData> = {}): PeggedChainsPageData => ({
	chainCirculatings: [row('Ethereum'), row('Arbitrum')],
	chainList: ['Ethereum', 'Arbitrum'],
	chainsGroupbyParent: {},
	deprecatedChains: {},
	change1d: '+11.11',
	change7d: '+25.00',
	change30d: '+42.86',
	totalMcapCurrent: 150,
	change1d_nol: '+15',
	change7d_nol: '+30',
	change30d_nol: '+45',
	dataTimestamp: Date.parse('2026-07-22T00:00:00Z') / 1e3,
	isDataStale: false,
	...overrides
})

const TODAY = Date.parse('2026-07-22T00:00:00Z') / 1e3
const THREE_DAYS_AGO = Date.parse('2026-07-19T00:00:00Z') / 1e3

describe('revalidating a stored chains page', () => {
	test('a stale aggregate loses its changes and is flagged; a chain with fresh history keeps its row', async () => {
		const { revalidateStablecoinChainsPageData } = await import('../queries.server')
		const stored = pageData({ dataTimestamp: THREE_DAYS_AGO })

		const result = revalidateStablecoinChainsPageData(
			{ pageData: stored, latestChainTimestamps: { Ethereum: TODAY, Arbitrum: THREE_DAYS_AGO } },
			NOW
		)

		expect(result).toMatchObject({
			isDataStale: true,
			change1d: null,
			change7d: null,
			change30d: null,
			change1d_nol: null,
			change7d_nol: null,
			change30d_nol: null,
			totalMcapCurrent: 150,
			dataTimestamp: THREE_DAYS_AGO
		})
		expect(result.chainCirculatings).toEqual([row('Ethereum'), row('Arbitrum', clearedDeltas)])
	})

	test('a fresh aggregate keeps its changes while only the stale chain row is cleared, leaving the stored entry intact', async () => {
		const { revalidateStablecoinChainsPageData } = await import('../queries.server')
		const stored = pageData()

		const result = revalidateStablecoinChainsPageData(
			{ pageData: stored, latestChainTimestamps: { Ethereum: TODAY, Arbitrum: THREE_DAYS_AGO } },
			NOW
		)

		expect(result).toMatchObject({ change1d: '+11.11', change7d: '+25.00', change30d: '+42.86', isDataStale: false })
		expect(result.chainCirculatings).toEqual([row('Ethereum'), row('Arbitrum', clearedDeltas)])
		expect(stored).toEqual(pageData())
	})

	test('an aggregate with no timestamp is never marked stale', async () => {
		const { revalidateStablecoinChainsPageData } = await import('../queries.server')

		const result = revalidateStablecoinChainsPageData(
			{ pageData: pageData({ dataTimestamp: null }), latestChainTimestamps: { Ethereum: TODAY, Arbitrum: TODAY } },
			NOW
		)

		expect(result).toMatchObject({ dataTimestamp: null, isDataStale: false, change1d: '+11.11' })
	})

	test('an entry that is fresh everywhere is returned as stored', async () => {
		const { revalidateStablecoinChainsPageData } = await import('../queries.server')
		const stored = pageData()

		// The previous UTC day still counts as current until today's snapshot lands.
		const yesterday = Date.parse('2026-07-21T00:00:00Z') / 1e3
		const result = revalidateStablecoinChainsPageData(
			{ pageData: stored, latestChainTimestamps: { Ethereum: TODAY, Arbitrum: yesterday } },
			NOW
		)

		expect(result).toBe(stored)
	})
})
