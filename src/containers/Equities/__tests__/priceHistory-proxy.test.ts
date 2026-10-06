import { describe, expect, test } from 'vitest'
import { EQUITIES_SERVER_URL } from '~/constants'
import handler from '~/pages/api/public/equities/price-history'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { fetchEquitiesPriceHistoryFromProxy } from '../priceHistoryClient'
import { buildEquitiesPriceHistoryUpstreamUrl } from '../server/priceHistory.api'

const http = installFixtureFetch()

function upstreamUrl(query: Parameters<typeof buildEquitiesPriceHistoryUpstreamUrl>[0]): URL {
	const url = buildEquitiesPriceHistoryUpstreamUrl(query)
	if (!url) throw new Error('Expected a valid equities price history request')
	return new URL(url)
}

describe('equities price history proxy mapping', () => {
	test('returns upstream price history through the public proxy route', async () => {
		const query = { ticker: 'BRK.B', country: 'US', timeframe: 'MAX' } as const
		const chart = { data: [[1_700_000_000, 123]], updatedAt: '2026-09-01' }
		http.serve({
			[`${EQUITIES_SERVER_URL}/price-history`]: chart,
			'/api/public/equities/price-history': async (url: URL) => {
				const res = createMockNextApiResponse()
				await handler(createMockNextApiRequest({ method: 'GET', query: Object.fromEntries(url.searchParams) }), res)
				return new Response(res.send.mock.calls.at(-1)![0], {
					status: res.statusCode,
					headers: { 'content-type': 'application/json' }
				})
			}
		})
		expect(await fetchEquitiesPriceHistoryFromProxy(query.ticker, query.country, query.timeframe)).toEqual(chart)
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
