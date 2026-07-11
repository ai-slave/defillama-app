import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMarketsExchange } from '../api'
import {
	marketCategoriesList,
	marketCategory,
	marketCategorySeries,
	marketExchangesList,
	marketExchangeSeries,
	tokenMarketsList
} from '../server/api'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/constants')>()
	return { ...actual, MARKETS_SERVER_URL: 'https://markets-cache.example.com' }
})

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return { ...actual, fetchJson: fetchJsonMock }
})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('markets serialized response caches', () => {
	it.each([
		['token list', tokenMarketsList, '/api/public/markets/tokens', {}, '/tokens/list.json'],
		['category list', marketCategoriesList, '/api/public/markets/categories', {}, '/categories/list.json'],
		['category series', marketCategorySeries, '/api/public/markets/categories/series', {}, '/categories/series.json'],
		['exchange list', marketExchangesList, '/api/public/markets/exchanges', {}, '/exchanges/list.json'],
		['exchange series', marketExchangeSeries, '/api/public/markets/exchanges/series', {}, '/exchanges/series.json'],
		[
			'category detail',
			marketCategory,
			'/api/public/markets/categories/Serialized-Category',
			{ category: 'Serialized-Category' },
			'/categories/serialized-category.json'
		]
	])('serializes and reuses the final payload for %s', async (_label, route, url, query, upstreamPath) => {
		fetchJsonMock.mockResolvedValueOnce({ upstreamPath })
		const request = { method: 'GET', url, query, headers: {} }

		const first = await route.handle(request)
		const second = await route.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: JSON.stringify({ upstreamPath }) })
		expect(second).toEqual(first)
		expect(fetchJsonMock).toHaveBeenCalledTimes(1)
		expect(fetchJsonMock).toHaveBeenCalledWith(`https://markets-cache.example.com${upstreamPath}`, {
			timeout: 30_000
		})
	})

	it('keeps dynamic validation and not-found errors outside the result cache', async () => {
		const missing = await marketCategory.handle({ method: 'GET', url: '', query: {}, headers: {} })
		expect(missing).toEqual({ status: 400, body: { error: 'Missing category' } })

		fetchJsonMock.mockRejectedValueOnce(new Error('[404] Not Found'))
		const notFound = await marketCategory.handle({
			method: 'GET',
			url: '/api/public/markets/categories/missing-cache-test',
			query: { category: 'missing-cache-test' },
			headers: {}
		})
		expect(notFound).toEqual({ status: 404, body: { error: 'Category not found' } })
	})

	it('routes exchange detail callers through the canonical plural endpoint', async () => {
		fetchJsonMock.mockResolvedValue({ exchange: 'binance' })

		await fetchMarketsExchange('Binance')

		expect(fetchJsonMock).toHaveBeenCalledWith('/api/public/markets/exchanges/binance')
	})
})
