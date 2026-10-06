import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))

vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))
vi.mock('~/utils/cache-client', () => ({
	getObjectCache: mocks.getObjectCache,
	setObjectCache: mocks.setObjectCache
}))

import { fetchCoinGeckoChartByIdWithCacheFallback } from '../coingecko'

function requestedUrl(part: string): URL {
	const call = mocks.fetchJson.mock.calls.find(([url]) => url.includes(part))
	if (!call) throw new Error(`Missing request containing ${part}`)
	return new URL(call[0])
}

describe('CoinGecko chart timeframes', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getObjectCache.mockResolvedValue(null)
		mocks.setObjectCache.mockResolvedValue(true)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	test('uses bounded five-minute DefiLlama prices when the 24H CoinGecko chart is missing', async () => {
		mocks.fetchJson.mockImplementation(async (url: string) => {
			if (url.includes('/market_chart')) return {}
			if (url.includes('/chart/coingecko:bitcoin')) {
				return { coins: { 'coingecko:bitcoin': { prices: [{ timestamp: 1000, price: 10 }] } } }
			}
			return {}
		})

		const chart = await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', { timeframe: '24H' })
		const fallbackUrl = requestedUrl('/chart/coingecko:bitcoin')

		expect(Object.fromEntries(fallbackUrl.searchParams)).toEqual({ period: '5m', span: '288' })
		expect(chart?.data?.prices).toEqual([[1_000_000, 10]])
	})

	test.each([true, false])('keeps coin metadata independently when chart availability is %s', async (hasChart) => {
		mocks.fetchJson.mockImplementation(async (url: string) => {
			if (url.includes('/market_chart')) return hasChart ? { prices: [[1000, 10]] } : {}
			if (url.includes('/coins/bitcoin')) return { symbol: 'btc', links: { homepage: ['https://bitcoin.org'] } }
			return {}
		})

		const chart = await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', {
			timeframe: '24H',
			includeCoinData: true
		})

		expect(chart?.data?.coinData?.links?.homepage).toEqual(['https://bitcoin.org'])
		expect(chart?.data?.prices).toEqual(hasChart ? [[1000, 10]] : undefined)
	})

	test('requests and returns only the current UTC year for YTD', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-08-29T12:00:00Z'))
		const yearStartedAt = Date.parse('2026-01-01T00:00:00Z')
		mocks.fetchJson.mockImplementation(async (url: string) => {
			if (url.includes('/market_chart/range')) return {}
			if (url.includes('/chart/coingecko:bitcoin')) {
				return {
					coins: {
						'coingecko:bitcoin': {
							prices: [
								{ timestamp: yearStartedAt / 1e3 - 1, price: 9 },
								{ timestamp: yearStartedAt / 1e3, price: 10 }
							]
						}
					}
				}
			}
			return {}
		})

		const chart = await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', { timeframe: 'YTD' })
		const rangeUrl = requestedUrl('/market_chart/range')
		const fallbackUrl = requestedUrl('/chart/coingecko:bitcoin')

		expect(Object.fromEntries(rangeUrl.searchParams)).toEqual({
			vs_currency: 'usd',
			from: String(yearStartedAt / 1e3),
			to: String(Date.parse('2026-08-29T12:00:00Z') / 1e3)
		})
		expect(Object.fromEntries(fallbackUrl.searchParams)).toEqual({ period: '1d', span: '242' })
		expect(chart?.data?.prices).toEqual([[yearStartedAt, 10]])
		expect(mocks.getObjectCache).toHaveBeenCalledWith('cgchart_bitcoin_timeframe_YTD_2026')
	})

	test('removes negative market caps before caching fresh charts', async () => {
		const prices = [[1000, 10]]
		const volumes = [[1000, 20]]
		mocks.fetchJson.mockResolvedValue({
			prices,
			market_caps: [
				[1000, -1],
				[2000, 0],
				[3000, 30]
			],
			total_volumes: volumes
		})

		const chart = await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', { timeframe: '24H' })

		expect(chart?.data).toEqual({
			prices,
			mcaps: [
				[2000, 0],
				[3000, 30]
			],
			volumes
		})
		expect(mocks.setObjectCache).toHaveBeenCalledWith('cgchart_bitcoin_timeframe_24H', chart?.data, expect.any(Number))
	})

	test('removes negative market caps from existing cached charts', async () => {
		mocks.getObjectCache.mockResolvedValue({
			prices: [[1000, 10]],
			mcaps: [
				[1000, 10],
				[2000, -1],
				[3000, 30]
			]
		})

		const chart = await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', { timeframe: '24H' })

		expect(chart?.data?.mcaps).toEqual([
			[1000, 10],
			[3000, 30]
		])
		expect(mocks.fetchJson).not.toHaveBeenCalled()
	})
})
