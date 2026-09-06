import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchBlockExplorers: vi.fn(),
	fetchLlamaConfig: vi.fn(),
	fetchStablecoinAssetApi: vi.fn(),
	fetchStablecoinAssetsApi: vi.fn(),
	fetchStablecoinBridgeInfoApi: vi.fn(),
	fetchStablecoinChartAllApi: vi.fn(),
	fetchStablecoinChartApi: vi.fn(),
	fetchStablecoinDominanceAllApi: vi.fn(),
	fetchStablecoinPeggedConfigApi: vi.fn(),
	fetchStablecoinPricesApi: vi.fn(),
	fetchStablecoinRatesApi: vi.fn(),
	fetchStablecoinRecentCoinsDataApi: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))

vi.mock('~/api', () => ({
	fetchBlockExplorers: mocks.fetchBlockExplorers,
	fetchLlamaConfig: mocks.fetchLlamaConfig
}))
vi.mock('~/utils/cache-client', () => ({
	getObjectCache: mocks.getObjectCache,
	setObjectCache: mocks.setObjectCache
}))
vi.mock('~/utils/metadata', () => ({ default: { chainMetadata: {} } }))
vi.mock('../api', () => ({
	fetchStablecoinAssetApi: mocks.fetchStablecoinAssetApi,
	fetchStablecoinAssetsApi: mocks.fetchStablecoinAssetsApi,
	fetchStablecoinBridgeInfoApi: mocks.fetchStablecoinBridgeInfoApi,
	fetchStablecoinChartAllApi: mocks.fetchStablecoinChartAllApi,
	fetchStablecoinChartApi: mocks.fetchStablecoinChartApi,
	fetchStablecoinDominanceAllApi: mocks.fetchStablecoinDominanceAllApi,
	fetchStablecoinPeggedConfigApi: mocks.fetchStablecoinPeggedConfigApi,
	fetchStablecoinPricesApi: mocks.fetchStablecoinPricesApi,
	fetchStablecoinRatesApi: mocks.fetchStablecoinRatesApi,
	fetchStablecoinRecentCoinsDataApi: mocks.fetchStablecoinRecentCoinsDataApi
}))

import { getStablecoinChainsChartSeries, getStablecoinChainsPageData } from '../queries.server'
import type { PeggedChainsPageData } from '../types'

const NOW = Date.parse('2026-07-22T12:00:00Z')
const timestamp = (daysAgo: number) => String(Math.floor(NOW / 1e3) - daysAgo * 86_400)
const ethereumHistory = [
	{ date: timestamp(30), totalCirculatingUSD: { peggedUSD: 70 } },
	{ date: timestamp(7), totalCirculatingUSD: { peggedUSD: 80 } },
	{ date: timestamp(1), totalCirculatingUSD: { peggedUSD: 90 } },
	{
		date: timestamp(0),
		totalCirculatingUSD: { peggedUSD: 100 },
		totalCirculating: { peggedUSD: 100 },
		totalUnreleased: { peggedUSD: 10 },
		totalBridgedToUSD: { peggedUSD: 20 },
		totalMintedUSD: { peggedUSD: 30 }
	}
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
const stablecoinAssets = {
	peggedAssets: [
		{
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
	],
	chains: [
		{ name: 'Ethereum', totalCirculatingUSD: { peggedUSD: 80 } },
		{ name: 'Arbitrum', totalCirculatingUSD: { peggedUSD: 60 } }
	]
}
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

type PageCacheEntry = {
	pageData: PeggedChainsPageData
	latestChainTimestamps: Record<string, number | null>
}

const findStoredValue = (key: string): unknown => {
	const call = mocks.setObjectCache.mock.calls.find(([cacheKey]) => cacheKey === key)
	return call?.[1]
}

const findStoredPageEntry = (): PageCacheEntry => {
	return findStoredValue('stablecoins:chains-page-data-v5') as PageCacheEntry
}

const getCachedChainTimestamp = (entry: PageCacheEntry, chain: string): number | null => {
	const value = entry.latestChainTimestamps[chain]
	if (value === undefined) throw new Error(`Missing cached timestamp for ${chain}`)
	return value
}

const getChainRow = (pageData: PeggedChainsPageData, chain: string) => {
	const row = pageData.chainCirculatings.find((candidate) => candidate.name === chain)
	if (!row) throw new Error(`Missing ${chain} chain row`)
	return row
}

const rejectStablecoinChainUpstreams = () => {
	mocks.fetchStablecoinAssetsApi.mockRejectedValue(new Error('assets unavailable'))
	mocks.fetchLlamaConfig.mockRejectedValue(new Error('config unavailable'))
	mocks.fetchStablecoinChartAllApi.mockRejectedValue(new Error('aggregate unavailable'))
	mocks.fetchStablecoinDominanceAllApi.mockRejectedValue(new Error('chains unavailable'))
}

const serveCachedEntries = (pageEntry: PageCacheEntry, chartSource?: unknown) => {
	mocks.getObjectCache.mockImplementation(async (key: string) => {
		if (key === 'stablecoins:chains-page-data-v5') return pageEntry
		if (key === 'stablecoins:chains-chart-source-v4') return chartSource ?? null
		return null
	})
}

describe('stablecoin chain consumer caches', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(NOW)
		vi.resetAllMocks()
		mocks.getObjectCache.mockResolvedValue(null)
		mocks.setObjectCache.mockResolvedValue(undefined)
		mocks.fetchStablecoinAssetsApi.mockResolvedValue(stablecoinAssets)
		mocks.fetchLlamaConfig.mockResolvedValue({ chainCoingeckoIds: {} })
		mocks.fetchStablecoinChartAllApi.mockResolvedValue({
			aggregated: aggregateHistory,
			breakdown: { asset: aggregateHistory },
			doublecountedIds: []
		})
		mocks.fetchStablecoinDominanceAllApi.mockResolvedValue(dominance)
	})
	afterEach(() => vi.useRealTimers())

	test('stores compact page data without raw assets, config, or chart histories', async () => {
		const page = await getStablecoinChainsPageData()
		const cachedEntry = findStoredPageEntry()

		expect(cachedEntry).toEqual({
			pageData: page,
			latestChainTimestamps: { Ethereum: Number(timestamp(0)), Arbitrum: Number(timestamp(0)) }
		})
		expect(cachedEntry).not.toHaveProperty('peggedAssets')
		expect(cachedEntry).not.toHaveProperty('chainCoingeckoIds')
		expect(cachedEntry).not.toHaveProperty('chainChartMap')
		expect(cachedEntry).not.toHaveProperty('dominanceMap')
		expect(page).not.toHaveProperty('latestChainTimestamps')
		expect(mocks.fetchStablecoinAssetsApi).toHaveBeenCalledOnce()
		expect(mocks.fetchLlamaConfig).toHaveBeenCalledOnce()
		expect(mocks.fetchStablecoinChartAllApi).toHaveBeenCalledOnce()
		expect(mocks.fetchStablecoinDominanceAllApi).toHaveBeenCalledOnce()
	})

	test('builds the chain-page headline from exclusion-safe asset histories', async () => {
		const doublecountedAsset = {
			...stablecoinAssets.peggedAssets[0],
			id: 'double',
			name: 'Double Stablecoin',
			symbol: 'DOUBLE'
		}
		const doublecountedHistory = aggregateHistory.map((point) => ({
			...point,
			totalCirculatingUSD: { peggedUSD: 50 }
		}))
		mocks.fetchStablecoinAssetsApi.mockResolvedValue({
			...stablecoinAssets,
			peggedAssets: [...stablecoinAssets.peggedAssets, doublecountedAsset]
		})
		mocks.fetchStablecoinChartAllApi.mockResolvedValue({
			aggregated: aggregateHistory.map((point) => ({
				...point,
				totalCirculatingUSD: { peggedUSD: (point.totalCirculatingUSD.peggedUSD ?? 0) + 50 }
			})),
			breakdown: { asset: aggregateHistory, double: doublecountedHistory },
			doublecountedIds: ['double']
		})

		const page = await getStablecoinChainsPageData()

		expect(page.totalMcapCurrent).toBe(150)
		expect(page.change1d).toBe('+11.11')
	})

	test('stores only normalized chart histories and avoids page-only requests', async () => {
		await getStablecoinChainsChartSeries('chainMcaps', false, 10)
		const cachedSource = findStoredValue('stablecoins:chains-chart-source-v4')

		expect(cachedSource).toEqual({
			chainList: ['Ethereum', 'Arbitrum'],
			chartDataByChain: [
				[
					{ date: Number(timestamp(30)), mcap: 70 },
					{ date: Number(timestamp(7)), mcap: 80 },
					{ date: Number(timestamp(1)), mcap: 90 },
					{ date: Number(timestamp(0)), mcap: 100 }
				],
				[
					{ date: Number(timestamp(30)), mcap: 35 },
					{ date: Number(timestamp(7)), mcap: 40 },
					{ date: Number(timestamp(1)), mcap: 45 },
					{ date: Number(timestamp(0)), mcap: 50 }
				]
			]
		})
		expect(cachedSource).not.toHaveProperty('peggedAssets')
		expect(cachedSource).not.toHaveProperty('chainCoingeckoIds')
		expect(cachedSource).not.toHaveProperty('chainCirculatings')
		expect(cachedSource).not.toHaveProperty('chainsGroupbyParent')
		expect(mocks.fetchStablecoinAssetsApi).toHaveBeenCalledOnce()
		expect(mocks.fetchStablecoinDominanceAllApi).toHaveBeenCalledOnce()
		expect(mocks.fetchLlamaConfig).not.toHaveBeenCalled()
		expect(mocks.fetchStablecoinChartAllApi).not.toHaveBeenCalled()
	})

	test('reuses shared upstream results across page and chart caches', async () => {
		await getStablecoinChainsPageData()
		await getStablecoinChainsChartSeries('totalMcap')

		expect(mocks.fetchStablecoinAssetsApi).toHaveBeenCalledOnce()
		expect(mocks.fetchStablecoinDominanceAllApi).toHaveBeenCalledOnce()
		expect(mocks.fetchLlamaConfig).toHaveBeenCalledOnce()
		expect(mocks.fetchStablecoinChartAllApi).toHaveBeenCalledOnce()
	})

	test('falls back independently to the versioned page and chart cache entries', async () => {
		const page = await getStablecoinChainsPageData()
		const pageEntry = findStoredPageEntry()
		const chart = await getStablecoinChainsChartSeries('totalMcap')
		const cachedChartSource = findStoredValue('stablecoins:chains-chart-source-v4')

		rejectStablecoinChainUpstreams()
		serveCachedEntries(pageEntry, cachedChartSource)

		await expect(getStablecoinChainsPageData()).resolves.toEqual(page)
		await expect(getStablecoinChainsChartSeries('totalMcap')).resolves.toEqual(chart)
	})

	test('returns a fully fresh cache entry and its rows without cloning or leaking timestamps', async () => {
		await getStablecoinChainsPageData()
		const cachedEntry = findStoredPageEntry()
		rejectStablecoinChainUpstreams()
		serveCachedEntries(cachedEntry)
		vi.setSystemTime(Date.parse('2026-07-23T12:00:00Z'))

		const fallback = await getStablecoinChainsPageData()

		expect(fallback).toBe(cachedEntry.pageData)
		expect(fallback.chainCirculatings[0]).toBe(cachedEntry.pageData.chainCirculatings[0])
		expect(fallback.chainCirculatings[1]).toBe(cachedEntry.pageData.chainCirculatings[1])
		expect(fallback).not.toHaveProperty('latestChainTimestamps')
	})

	test('clears stale aggregate fields while preserving a chain with fresh history', async () => {
		await getStablecoinChainsPageData()
		const storedEntry = findStoredPageEntry()
		const cachedEntry: PageCacheEntry = {
			pageData: storedEntry.pageData,
			latestChainTimestamps: {
				Ethereum: Date.parse('2026-07-25T00:00:00Z') / 1e3,
				Arbitrum: getCachedChainTimestamp(storedEntry, 'Arbitrum')
			}
		}
		rejectStablecoinChainUpstreams()
		serveCachedEntries(cachedEntry)
		vi.setSystemTime(Date.parse('2026-07-25T12:00:00Z'))

		const fallback = await getStablecoinChainsPageData()

		expect(fallback).toMatchObject({
			isDataStale: true,
			change1d: null,
			change7d: null,
			change30d: null,
			change1d_nol: null,
			change7d_nol: null,
			change30d_nol: null,
			totalMcapCurrent: storedEntry.pageData.totalMcapCurrent,
			dataTimestamp: storedEntry.pageData.dataTimestamp
		})
		const fallbackEthereum = getChainRow(fallback, 'Ethereum')
		expect(fallbackEthereum).toBe(getChainRow(storedEntry.pageData, 'Ethereum'))
		expect(fallbackEthereum.mcapPrevDay).not.toBeNull()
		expect(getChainRow(fallback, 'Arbitrum')).toEqual({
			...getChainRow(storedEntry.pageData, 'Arbitrum'),
			mcapPrevDay: null,
			mcapPrevWeek: null,
			mcapPrevMonth: null,
			change_1d: null,
			change_7d: null,
			change_1m: null
		})
	})

	test('preserves fresh aggregate changes while clearing only a stale chain row', async () => {
		await getStablecoinChainsPageData()
		const storedEntry = findStoredPageEntry()
		const cachedEntry: PageCacheEntry = {
			pageData: storedEntry.pageData,
			latestChainTimestamps: {
				Ethereum: getCachedChainTimestamp(storedEntry, 'Ethereum'),
				Arbitrum: Date.parse('2026-07-19T00:00:00Z') / 1e3
			}
		}
		const cachedSnapshot = structuredClone(cachedEntry)
		rejectStablecoinChainUpstreams()
		serveCachedEntries(cachedEntry)

		const firstFallback = await getStablecoinChainsPageData()
		const secondFallback = await getStablecoinChainsPageData()

		expect(firstFallback.change1d).toBe(storedEntry.pageData.change1d)
		expect(firstFallback.change7d).toBe(storedEntry.pageData.change7d)
		expect(firstFallback.change30d).toBe(storedEntry.pageData.change30d)
		expect(firstFallback.isDataStale).toBe(false)
		expect(firstFallback.chainCirculatings[0]).toBe(storedEntry.pageData.chainCirculatings[0])
		expect(firstFallback.chainCirculatings[1]).not.toBe(storedEntry.pageData.chainCirculatings[1])
		expect(getChainRow(firstFallback, 'Arbitrum')).toMatchObject({
			mcap: getChainRow(storedEntry.pageData, 'Arbitrum').mcap,
			mcapPrevDay: null,
			mcapPrevWeek: null,
			mcapPrevMonth: null,
			change_1d: null,
			change_7d: null,
			change_1m: null
		})
		expect(secondFallback).toEqual(firstFallback)
		expect(cachedEntry).toEqual(cachedSnapshot)
	})

	test('keeps aggregate freshness unset while independently clearing a stale chain', async () => {
		await getStablecoinChainsPageData()
		const storedEntry = findStoredPageEntry()
		const cachedEntry: PageCacheEntry = {
			pageData: { ...storedEntry.pageData, dataTimestamp: null, isDataStale: false },
			latestChainTimestamps: {
				Ethereum: getCachedChainTimestamp(storedEntry, 'Ethereum'),
				Arbitrum: Date.parse('2026-07-19T00:00:00Z') / 1e3
			}
		}
		rejectStablecoinChainUpstreams()
		serveCachedEntries(cachedEntry)

		const fallback = await getStablecoinChainsPageData()

		expect(fallback).toMatchObject({
			dataTimestamp: null,
			isDataStale: false,
			change1d: cachedEntry.pageData.change1d,
			change7d: cachedEntry.pageData.change7d,
			change30d: cachedEntry.pageData.change30d
		})
		expect(fallback.chainCirculatings[0]).toBe(cachedEntry.pageData.chainCirculatings[0])
		expect(fallback.chainCirculatings[1]).toMatchObject({
			mcapPrevDay: null,
			mcapPrevWeek: null,
			mcapPrevMonth: null,
			change_1d: null,
			change_7d: null,
			change_1m: null
		})
	})
})
