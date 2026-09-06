import { describe, expect, test, vi } from 'vitest'
import { fetchEquitiesPriceHistoryFromProxy } from '../priceHistoryClient'
import { buildEquitiesPriceHistoryUpstreamUrl } from '../server/priceHistory.api'

const fetchJsonMock = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({
	fetchJson: fetchJsonMock
}))

function upstreamUrl(query: Parameters<typeof buildEquitiesPriceHistoryUpstreamUrl>[0]): URL {
	const url = buildEquitiesPriceHistoryUpstreamUrl(query)
	if (!url) throw new Error('Expected a valid equities price history request')
	return new URL(url)
}

describe('equities price history proxy mapping', () => {
	test('preserves the requested identity and timeframe through both proxy URL builders', async () => {
		const query = { ticker: 'BRK.B', country: 'US', timeframe: 'MAX' } as const
		fetchJsonMock.mockResolvedValue([])
		await fetchEquitiesPriceHistoryFromProxy(query.ticker, query.country, query.timeframe)

		const proxyUrl = fetchJsonMock.mock.lastCall?.[0]
		if (typeof proxyUrl !== 'string') throw new Error('Missing equities price history proxy request')
		const proxy = new URL(proxyUrl, 'https://defillama.com')
		expect(proxy.pathname).toBe('/api/public/equities/price-history')
		const forwarded = Object.fromEntries(proxy.searchParams)
		expect(forwarded).toEqual(query)

		const upstream = upstreamUrl(forwarded)
		expect(upstream.pathname).toMatch(/\/price-history$/)
		expect(Object.fromEntries(upstream.searchParams)).toMatchObject(query)
	})

	test.each([
		['24H', '1D'],
		['7D', '1W']
	])('maps the public %s timeframe to the equities backend %s timeframe', (timeframe, upstreamTimeframe) => {
		const upstream = upstreamUrl({ ticker: 'NVDA', country: 'US', timeframe })

		expect(upstream.searchParams.get('timeframe')).toBe(upstreamTimeframe)
	})

	test('rejects requests missing a ticker or country', () => {
		expect(buildEquitiesPriceHistoryUpstreamUrl({ country: 'US', timeframe: '24H' })).toBeNull()
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', timeframe: '24H' })).toBeNull()
	})

	test('rejects unsupported or missing timeframes', () => {
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', country: 'US', timeframe: '10Y' })).toBeNull()
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', country: 'US', timeframe: '1D' })).toBeNull()
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', country: 'US', timeframe: '1W' })).toBeNull()
		expect(buildEquitiesPriceHistoryUpstreamUrl({ ticker: 'NVDA', country: 'US' })).toBeNull()
	})
})
