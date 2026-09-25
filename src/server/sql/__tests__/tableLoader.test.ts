import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_SERVER_URL, V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { clearCsvCacheForTests, fetchCsvForSource } from '../tableLoader'

const http = installFixtureFetch()

const CHAINS = { kind: 'dataset', slug: 'chains' } as const
const chainTvl = (param: string) => ({ kind: 'chart', slug: 'protocol-tvl-chart', param }) as const
const upstreamCalls = (path: string) => http.requests.filter((request) => request.url.href.includes(path)).length

beforeEach(() => {
	clearCsvCacheForTests()
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('datasets', () => {
	test('builds CSV from the dataset’s curated fields, quoting commas', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chains`]: [
				{ name: 'Ethereum', tokenSymbol: 'ETH', tvl: 100, chainId: 1, ignored: true },
				{ name: 'Base, L2', tokenSymbol: null, tvl: 200, chainId: 8453 }
			]
		})
		expect(await fetchCsvForSource(CHAINS)).toBe(
			'name,tokenSymbol,tvl,chainId\r\nEthereum,ETH,100,1\r\n"Base, L2",,200,8453'
		)
	})

	test('serves repeat loads from cache and refetches after the 10 minute TTL', async () => {
		http.serve({ [`${V2_SERVER_URL}/chains`]: [{ name: 'Ethereum', tvl: 1 }] })
		await fetchCsvForSource(CHAINS)
		await fetchCsvForSource(CHAINS)
		expect(upstreamCalls('/chains')).toBe(1)
		vi.advanceTimersByTime(11 * 60 * 1000)
		await fetchCsvForSource(CHAINS)
		expect(upstreamCalls('/chains')).toBe(2)
	})

	test('concurrent loads of the same source share one upstream request', async () => {
		const upstream = Promise.withResolvers<Response>()
		http.serve({ [`${V2_SERVER_URL}/chains`]: () => upstream.promise })
		const both = Promise.all([fetchCsvForSource(CHAINS), fetchCsvForSource(CHAINS)])
		upstream.resolve(Response.json([{ name: 'Ethereum', tvl: 1 }]))
		const [first, second] = await both
		expect(second).toBe(first)
		expect(upstreamCalls('/chains')).toBe(1)
	})

	test('does not cache a failed upstream', async () => {
		let status = 502
		http.serve({ [`${V2_SERVER_URL}/chains`]: () => Response.json([{ name: 'Ethereum', tvl: 1 }], { status }) })
		await expect(fetchCsvForSource(CHAINS)).rejects.toThrow('Upstream API returned 502 for dataset "chains"')
		status = 200
		await expect(fetchCsvForSource(CHAINS)).resolves.toBe('name,tokenSymbol,tvl,chainId\r\nEthereum,,1,')
	})

	test('rejects an unknown dataset', async () => {
		await expect(fetchCsvForSource({ kind: 'dataset', slug: 'nope' })).rejects.toThrow('Dataset "nope" not found')
	})
})

describe('chart datasets', () => {
	test('formats timestamps as dates and caches per param', async () => {
		http.serve({ [`${V2_SERVER_URL}/chart/tvl/protocol/`]: [[1_700_000_000, 5]] })
		expect(await fetchCsvForSource(chainTvl('aave'))).toBe('date,value\r\n2023-11-14,5')
		await fetchCsvForSource(chainTvl('aave'))
		await fetchCsvForSource(chainTvl('uniswap'))
		expect(upstreamCalls('/chart/tvl/protocol/')).toBe(2)
	})

	test('rejects a chart with no rows', async () => {
		http.serve({ [`${V2_SERVER_URL}/chart/tvl/protocol/`]: [] })
		await expect(fetchCsvForSource(chainTvl('aave'))).rejects.toThrow(
			'No data returned for chart "protocol-tvl-chart" with param "aave"'
		)
	})

	test('times out a custom chart fetch whose upstream never answers', async () => {
		http.serve({ [RWA_SERVER_URL]: () => new Promise<Response>(() => undefined) })
		const pending = fetchCsvForSource({ kind: 'chart', slug: 'rwa-asset-chart', param: 'treasuries' })
		// eslint-disable-next-line vitest/valid-expect -- awaited after the fake timers advance
		const assertion = expect(pending).rejects.toThrow('Upstream timeout for chart "rwa-asset-chart"')
		await vi.advanceTimersByTimeAsync(15_001)
		await assertion
	})
})
