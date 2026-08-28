import { describe, expect, it, vi } from 'vitest'
import { fetchEquitiesPriceHistoryFromProxy } from '../priceHistoryClient'
import { buildEquitiesPriceHistoryUpstreamUrl } from '../server/priceHistory.api'

const fetchJsonMock = vi.fn()
vi.mock('~/utils/async', () => ({
	fetchJson: (...args: unknown[]) => fetchJsonMock(...args)
}))

describe('equities price history proxy mapping', () => {
	it('preserves the requested identity and timeframe through both proxy URL builders', async () => {
		const query = { ticker: 'BRK.B', country: 'US', timeframe: 'MAX' } as const
		fetchJsonMock.mockResolvedValue([])
		await fetchEquitiesPriceHistoryFromProxy(query.ticker, query.country, query.timeframe)

		const proxy = new URL(fetchJsonMock.mock.calls[0][0], 'https://defillama.com')
		expect(proxy.pathname).toBe('/api/public/equities/price-history')
		const forwarded = Object.fromEntries(proxy.searchParams)
		expect(forwarded).toEqual(query)

		const upstream = new URL(buildEquitiesPriceHistoryUpstreamUrl(forwarded)!)
		expect(upstream.pathname).toMatch(/\/price-history$/)
		expect(Object.fromEntries(upstream.searchParams)).toMatchObject(query)
	})

	it('rejects requests missing a ticker or country', () => {
		expect(buildEquitiesPriceHistoryUpstreamUrl({ country: 'US', timeframe: '1D' })).toBeNull()
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', timeframe: '1D' })).toBeNull()
	})

	it('rejects unsupported or missing timeframes', () => {
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', country: 'US', timeframe: '10Y' })).toBeNull()
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', country: 'US' })).toBeNull()
	})
})
