import type { NextApiRequest } from 'next'
import { describe, expect, test } from 'vitest'
import { COINS_CHART_API } from '~/constants'
import handler from '~/pages/api/public/tokens/charts/coingecko/[geckoId]'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { serve, urls } = installFixtureFetch()

const CG = '/api/v3/coins'

async function run(query: NextApiRequest['query']) {
	const req = createMockNextApiRequest({ method: 'GET', query })
	req.url = `/api/public/tokens/charts/coingecko/${query.geckoId}`
	const res = createMockNextApiResponse()
	await handler(req, res)
	return {
		status: res.statusCode,
		body: res.json.mock.calls[0]?.[0],
		cacheControl: res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1] as string
	}
}

describe('/api/public/tokens/charts/coingecko/[geckoId]', () => {
	test('returns the CoinGecko market chart for the requested timeframe', async () => {
		serve({
			[`${CG}/wrapped-bitcoin_2.test-token/market_chart`]: {
				prices: [[1, 2]],
				market_caps: [[1, 3]],
				total_volumes: [[1, 4]]
			}
		})

		const response = await run({ geckoId: 'wrapped-bitcoin_2.test-token', timeframe: 'MAX' })

		expect(response.status).toBe(200)
		expect(response.body).toEqual({ data: { prices: [[1, 2]], mcaps: [[1, 3]], volumes: [[1, 4]] } })
		expect(response.cacheControl).toContain('s-maxage=')
		expect(urls()).toEqual([
			'https://api.coingecko.com/api/v3/coins/wrapped-bitcoin_2.test-token/market_chart?vs_currency=usd&days=max'
		])
	})

	test('maps the 24H timeframe to a one day CoinGecko window', async () => {
		serve({ [`${CG}/bitcoin/market_chart`]: { prices: [[1, 2]] } })

		const response = await run({ geckoId: 'bitcoin', timeframe: '24H' })

		expect(response.status).toBe(200)
		expect(urls()[0]).toContain('/coins/bitcoin/market_chart?vs_currency=usd&days=1')
	})

	test('attaches coin metadata only when the caller asks for it', async () => {
		serve({
			[`${CG}/bitcoin/market_chart`]: { prices: [[1, 2]] },
			[`${CG}/bitcoin`]: { id: 'bitcoin', symbol: 'btc', market_data: { current_price: { usd: 2 } } }
		})

		const response = await run({ geckoId: 'bitcoin', timeframe: 'MAX', includeCoinData: 'true' })

		expect(response.status).toBe(200)
		expect(response.body).toEqual({
			data: { prices: [[1, 2]], coinData: { id: 'bitcoin', symbol: 'btc', market_data: { current_price: { usd: 2 } } } }
		})
	})

	test('falls back to DefiLlama price history when CoinGecko has no chart', async () => {
		serve({
			[`${CG}/newcoin/market_chart`]: fixtureStatus(404, { error: 'coin not found' }),
			[`${COINS_CHART_API}/coingecko:newcoin`]: {
				coins: { 'coingecko:newcoin': { prices: [{ timestamp: 1_700_000_000, price: 1.5 }] } }
			}
		})

		const response = await run({ geckoId: 'newcoin', timeframe: '7D' })

		expect(response.status).toBe(200)
		expect(response.body).toEqual({ data: { prices: [[1_700_000_000_000, 1.5]] } })
	})

	test('returns an uncacheable null chart when neither source has prices', async () => {
		serve({
			[`${CG}/ghost/market_chart`]: { prices: [] },
			[`${COINS_CHART_API}/coingecko:ghost`]: { coins: {} }
		})

		const response = await run({ geckoId: 'ghost', timeframe: 'MAX' })

		expect(response.status).toBe(200)
		expect(response.body).toBeNull()
		expect(response.cacheControl).toBe('no-store')
	})

	test.each([undefined, '10Y', '1D'])('rejects the %s timeframe without contacting CoinGecko', async (timeframe) => {
		const response = await run({ geckoId: 'bitcoin', timeframe })

		expect(response.status).toBe(400)
		expect(response.body).toEqual({ error: 'Invalid timeframe parameter' })
		expect(urls()).toEqual([])
	})

	test('rejects CoinGecko ids with characters outside the id alphabet', async () => {
		const response = await run({ geckoId: 'bad id', timeframe: 'MAX' })

		expect(response.status).toBe(400)
		expect(response.body).toEqual({ error: 'Invalid geckoId parameter' })
		expect(urls()).toEqual([])
	})

	test('returns the total supply from the CoinGecko coin detail', async () => {
		serve({ [`${CG}/aave`]: { market_data: { total_supply: 123 } } })

		const response = await run({ geckoId: 'aave', kind: 'supply' })

		expect(response.status).toBe(200)
		expect(response.body).toEqual({ totalSupply: 123 })
		expect(response.cacheControl).toContain('s-maxage=')
		expect(urls()[0]).toContain('/coins/aave?localization=false&tickers=false&market_data=true')
	})

	test.each([
		['has no supply value', { market_data: {} }],
		['has no market data', {}],
		['is not a CoinGecko coin', fixtureStatus(404, { error: 'coin not found' })]
	])('returns an uncacheable null supply when the coin %s', async (_label, detail) => {
		serve({ [`${CG}/aave`]: detail })

		const response = await run({ geckoId: 'aave', kind: 'supply' })

		expect(response.status).toBe(200)
		expect(response.body).toEqual({ totalSupply: null })
		expect(response.cacheControl).toBe('no-store')
	})

	test('reports a failure when CoinGecko cannot serve the coin detail', async () => {
		serve({ [`${CG}/aave`]: fixtureStatus(400, { error: 'upstream unavailable' }) })

		const response = await run({ geckoId: 'aave', kind: 'supply' })

		expect(response.status).toBe(500)
		expect(response.body).toEqual({ error: 'Failed to load coingecko chart data' })
		expect(response.cacheControl).toBe('no-store')
	})
})
