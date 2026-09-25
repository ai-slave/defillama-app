import { beforeEach, expect, test, vi } from 'vitest'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installTelemetrySink } from '~/utils/testing/telemetry'

const http = installTelemetrySink()
const publicPrices = 'https://coins.llama.fi/prices/current/'
const proPrices = 'https://pro-api.llama.fi/pro-secret/coins/'
function priceFor(coin: string) {
	return { confidence: 0.99, price: coin.length, symbol: coin.toUpperCase(), timestamp: 1 }
}
function priceResponse(url: URL, init?: RequestInit) {
	const coins: Array<string> =
		init?.method === 'POST' ? JSON.parse(init.body as string).coins : url.pathname.split('/current/')[1].split(',')
	return { coins: Object.fromEntries(coins.map((coin) => [coin, priceFor(coin)])) }
}
beforeEach(() => {
	vi.resetModules()
	vi.stubEnv('API_KEY', '')
	http.serve({ [publicPrices]: priceResponse, [proPrices]: priceResponse })
})
const priceRequests = () => http.requests.filter((request) => request.url.hostname !== 'telemetry.test')

test('uses public GET batches of ten without a server key', async () => {
	const { fetchCoinPrices } = await import('../pricing')
	const coins = Array.from({ length: 11 }, (_, i) => `coingecko:get-${i}`)
	const prices = await fetchCoinPrices(coins, { searchWidth: '4h' })
	expect(priceRequests().map((request) => request.url.href)).toEqual([
		`${publicPrices}${coins.slice(0, 10).join(',')}?searchWidth=4h`,
		`${publicPrices}${coins[10]}?searchWidth=4h`
	])
	expect(prices).toEqual(Object.fromEntries(coins.map((coin) => [coin, priceFor(coin)])))
})

test('keeps the server key out of browser requests', async () => {
	vi.stubEnv('API_KEY', 'pro-secret')
	vi.stubGlobal('window', {})
	const { fetchCoinPrices } = await import('../pricing')
	const prices = await fetchCoinPrices(['coingecko:browser'])
	expect(priceRequests().map((request) => request.url.href)).toEqual([`${publicPrices}coingecko:browser`])
	expect(prices['coingecko:browser']).toEqual(priceFor('coingecko:browser'))
})

test('posts server batches of 100000 and preserves the trailing batch', async () => {
	vi.stubEnv('API_KEY', 'pro-secret')
	const { fetchCoinPrices } = await import('../pricing')
	const coins = Array.from({ length: 100_001 }, (_, i) => `coingecko:token-${i}`)
	const prices = await fetchCoinPrices(coins, { searchWidth: '4h' })
	expect(priceRequests().map((request) => request.url.href)).toEqual([
		`${proPrices}pro/prices/current`,
		`${proPrices}pro/prices/current`
	])
	expect(priceRequests().map((request) => request.init?.method)).toEqual(['POST', 'POST'])
	expect(priceRequests().map((request) => JSON.parse(request.init!.body as string))).toEqual([
		{ coins: coins.slice(0, 100_000), searchWidth: '4h' },
		{ coins: coins.slice(100_000), searchWidth: '4h' }
	])
	expect(Object.keys(prices)).toEqual(coins)
	expect(prices[coins[100_000]]).toEqual(priceFor(coins[100_000]))
})

test.each([404, 405])('falls back to GET when the producer rejects POST with %s', async (status) => {
	vi.stubEnv('API_KEY', 'pro-secret')
	http.serve({ [`${proPrices}pro/prices/current`]: fixtureStatus(status) })
	const { fetchCoinPrices } = await import('../pricing')
	const coins = Array.from({ length: 11 }, (_, i) => `coingecko:fallback-${i}`)
	expect(Object.keys(await fetchCoinPrices(coins))).toEqual(coins)
	expect(priceRequests().map((request) => request.url.pathname)).toEqual([
		'/pro-secret/coins/pro/prices/current',
		`/pro-secret/coins/prices/current/${coins.slice(0, 10).join(',')}`,
		`/pro-secret/coins/prices/current/${coins[10]}`
	])
})

test('preserves successful GET chunks and reports a failed chunk', async () => {
	vi.stubEnv('API_KEY', 'pro-secret')
	const coins = Array.from({ length: 11 }, (_, i) => `coingecko:fallback-${i}`)
	http.serve({
		[`${proPrices}pro/prices/current`]: fixtureStatus(404),
		[`${proPrices}prices/current/${coins.slice(0, 10).join(',')}`]: fixtureStatus(500)
	})
	const { fetchCoinPrices } = await import('../pricing')
	expect(await fetchCoinPrices(coins)).toEqual({ [coins[10]]: priceFor(coins[10]) })
	expect(await http.events()).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				type: 'runtime_error',
				phase: 'outboundFetch',
				attributes: expect.objectContaining({ coin_count: 10, first_coin: coins[0] })
			})
		])
	)
})

test('does not retry a failed server POST through the GET fallback', async () => {
	vi.stubEnv('API_KEY', 'pro-secret')
	http.serve({ [`${proPrices}pro/prices/current`]: fixtureStatus(500) })
	const { fetchCoinPrices } = await import('../pricing')
	expect(await fetchCoinPrices(['coingecko:ethereum'])).toEqual({})
	expect(priceRequests().length).toBeGreaterThan(0)
	expect(priceRequests().every((request) => request.init?.method === 'POST')).toBe(true)
	expect(await http.events()).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'runtime_error' })]))
})

test('maps a CoinGecko id to the price key and returns null for an absent price', async () => {
	const { fetchCoinPriceByCoinGeckoIdViaLlamaPrices } = await import('../pricing')
	expect(await fetchCoinPriceByCoinGeckoIdViaLlamaPrices('bitcoin')).toEqual(priceFor('coingecko:bitcoin'))
	http.serve({ [publicPrices]: { coins: {} } })
	expect(await fetchCoinPriceByCoinGeckoIdViaLlamaPrices('missing')).toBeNull()
})
