import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const fetchMock = vi.fn()

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: (...args: Array<unknown>) => fetchMock(...args)
}))

vi.mock('~/containers/Downloads/datasets', () => ({
	datasetsBySlug: new Map([
		[
			'test-protocols',
			{
				slug: 'test-protocols',
				url: 'https://api.example.com/protocols',
				fields: ['name', 'tvl'],
				extractItems: (json: any) => json.protocols
			}
		]
	])
}))

vi.mock('~/containers/Downloads/chart-datasets', () => ({
	chartDatasetsBySlug: new Map([
		[
			'test-chart',
			{
				slug: 'test-chart',
				buildUrl: (param: string) => `https://api.example.com/chart/${param}`,
				extractRows: (json: any) => json.rows
			}
		],
		[
			'test-custom',
			{
				slug: 'test-custom',
				customFetch: async (param: string) => [{ date: 1_700_000_000, value: param }]
			}
		],
		[
			'test-hanging',
			{
				slug: 'test-hanging',
				customFetch: () => new Promise(() => undefined)
			}
		]
	])
}))

import { cacheKeyForSource, clearCsvCacheForTests, fetchCsvForSource } from '../tableLoader'

const jsonResponse = (body: unknown) => ({
	ok: true,
	status: 200,
	json: async () => body
})

beforeEach(() => {
	clearCsvCacheForTests()
	fetchMock.mockReset()
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('cacheKeyForSource', () => {
	test('distinguishes datasets from chart params', () => {
		expect(cacheKeyForSource({ kind: 'dataset', slug: 'a' })).toBe('dataset:a')
		expect(cacheKeyForSource({ kind: 'chart', slug: 'a', param: 'eth' })).toBe('chart:a:eth')
	})
})

describe('fetchCsvForSource dataset path', () => {
	test('builds csv from extracted items with curated fields', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				protocols: [
					{ name: 'Aave', tvl: 100 },
					{ name: 'Uni, Swap', tvl: 200 }
				]
			})
		)
		const csv = await fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })
		expect(csv).toBe('name,tvl\r\nAave,100\r\n"Uni, Swap",200')
		expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/protocols', { timeout: 15_000 })
	})

	test('serves repeat loads from cache within ttl', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ protocols: [{ name: 'Aave', tvl: 1 }] }))
		await fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })
		await fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('refetches after ttl expiry', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ protocols: [{ name: 'Aave', tvl: 1 }] }))
		await fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })
		vi.advanceTimersByTime(11 * 60 * 1000)
		await fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	test('dedupes concurrent loads of the same source', async () => {
		let resolveUpstream: (value: unknown) => void
		fetchMock.mockReturnValue(
			new Promise((resolve) => {
				resolveUpstream = resolve
			})
		)
		const first = fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })
		const second = fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })
		resolveUpstream!(jsonResponse({ protocols: [{ name: 'Aave', tvl: 1 }] }))
		await Promise.all([first, second])
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	test('does not cache failures', async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 502 })
		await expect(fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })).rejects.toThrow(
			'Upstream API returned 502'
		)
		fetchMock.mockResolvedValueOnce(jsonResponse({ protocols: [{ name: 'Aave', tvl: 1 }] }))
		await expect(fetchCsvForSource({ kind: 'dataset', slug: 'test-protocols' })).resolves.toContain('Aave')
	})

	test('throws on unknown dataset', async () => {
		await expect(fetchCsvForSource({ kind: 'dataset', slug: 'nope' })).rejects.toThrow('Dataset "nope" not found')
	})
})

describe('fetchCsvForSource chart path', () => {
	test('builds csv from extracted rows with date formatting', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ rows: [{ date: 1_700_000_000, value: 5 }] }))
		const csv = await fetchCsvForSource({ kind: 'chart', slug: 'test-chart', param: 'ethereum' })
		expect(csv).toBe('date,value\r\n2023-11-14,5')
		expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/chart/ethereum', { timeout: 15_000 })
	})

	test('uses customFetch when defined', async () => {
		const csv = await fetchCsvForSource({ kind: 'chart', slug: 'test-custom', param: 'btc' })
		expect(csv).toContain('btc')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	test('caches per param, not per slug', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ rows: [{ date: 1_700_000_000, value: 5 }] }))
		await fetchCsvForSource({ kind: 'chart', slug: 'test-chart', param: 'ethereum' })
		await fetchCsvForSource({ kind: 'chart', slug: 'test-chart', param: 'solana' })
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	test('throws when chart returns no rows', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ rows: [] }))
		await expect(fetchCsvForSource({ kind: 'chart', slug: 'test-chart', param: 'ethereum' })).rejects.toThrow(
			'No data returned'
		)
	})

	test('times out hanging customFetch upstreams', async () => {
		const pending = fetchCsvForSource({ kind: 'chart', slug: 'test-hanging', param: 'x' })
		const assertion = expect(pending).rejects.toThrow('Upstream timeout for chart "test-hanging"')
		await vi.advanceTimersByTimeAsync(15_001)
		await assertion
	})
})
