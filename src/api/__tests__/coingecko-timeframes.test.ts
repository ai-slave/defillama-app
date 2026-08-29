import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

	it('requests a one-day CoinGecko chart for 24H', async () => {
		mocks.fetchJson.mockImplementation(async (url: string) =>
			url.includes('/market_chart') ? { prices: [[1_000, 10]] } : {}
		)

		await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', { timeframe: '24H' })

		expect(requestedUrl('/market_chart').searchParams.get('days')).toBe('1')
		expect(mocks.getObjectCache).toHaveBeenCalledWith('cgchart_bitcoin_timeframe_24H')
	})

	it('uses bounded five-minute DefiLlama prices when the 24H CoinGecko chart is missing', async () => {
		mocks.fetchJson.mockImplementation(async (url: string) => {
			if (url.includes('/market_chart')) return {}
			if (url.includes('/chart/coingecko:bitcoin')) {
				return { coins: { 'coingecko:bitcoin': { prices: [{ timestamp: 1_000, price: 10 }] } } }
			}
			return {}
		})

		const chart = await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', { timeframe: '24H' })
		const fallbackUrl = requestedUrl('/chart/coingecko:bitcoin')

		expect(Object.fromEntries(fallbackUrl.searchParams)).toEqual({ period: '5m', span: '288' })
		expect(chart?.data?.prices).toEqual([[1_000_000, 10]])
	})

	it('caches requested coin metadata separately from timeframe history', async () => {
		mocks.fetchJson.mockImplementation(async (url: string) => {
			if (url.includes('/market_chart')) return { prices: [[1_000, 10]] }
			if (url.includes('/coins/bitcoin')) return { symbol: 'btc', market_data: {} }
			return {}
		})

		const chart = await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', {
			timeframe: '24H',
			includeCoinData: true
		})

		expect(mocks.getObjectCache).toHaveBeenCalledWith('cgchart_bitcoin_timeframe_24H')
		expect(mocks.getObjectCache).toHaveBeenCalledWith('cgchart_bitcoin_coin_data')
		expect(mocks.setObjectCache).toHaveBeenCalledWith(
			'cgchart_bitcoin_coin_data',
			expect.objectContaining({ symbol: 'btc' }),
			expect.any(Number)
		)
		expect(chart?.data?.coinData?.symbol).toBe('btc')
	})

	it('requests and returns only the current UTC year for YTD', async () => {
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

	it('maps MAX to the full CoinGecko chart', async () => {
		mocks.fetchJson.mockResolvedValue({ prices: [[1_000, 10]] })

		await fetchCoinGeckoChartByIdWithCacheFallback('bitcoin', { timeframe: 'MAX' })

		expect(requestedUrl('/market_chart').searchParams.get('days')).toBe('max')
		expect(mocks.getObjectCache).toHaveBeenCalledWith('cgchart_bitcoin_timeframe_MAX')
	})
})
