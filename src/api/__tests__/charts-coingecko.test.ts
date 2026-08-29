import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchCoinGeckoChartByIdWithCacheFallbackMock, fetchCoinGeckoCoinByIdOrThrowMock, recordRouteRuntimeErrorMock } =
	vi.hoisted(() => ({
		fetchCoinGeckoChartByIdWithCacheFallbackMock: vi.fn(),
		fetchCoinGeckoCoinByIdOrThrowMock: vi.fn(),
		recordRouteRuntimeErrorMock: vi.fn()
	}))

vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoChartByIdWithCacheFallback: fetchCoinGeckoChartByIdWithCacheFallbackMock,
	fetchCoinGeckoCoinByIdOrThrow: fetchCoinGeckoCoinByIdOrThrowMock
}))

vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: recordRouteRuntimeErrorMock,
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler
}))

import handler from '~/pages/api/public/tokens/charts/coingecko/[geckoId]'

function request(query: NextApiRequest['query'], url: string): NextApiRequest {
	const req = createMockNextApiRequest({ method: 'GET', query })
	req.url = url
	return req
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe('/api/public/tokens/charts/coingecko/[geckoId]', () => {
	it('returns cached chart data for valid CoinGecko ids with allowed punctuation', async () => {
		fetchCoinGeckoChartByIdWithCacheFallbackMock.mockResolvedValueOnce({ data: { prices: [[1, 2]] } })
		const res = createMockNextApiResponse()

		await handler(
			request(
				{ geckoId: 'wrapped-bitcoin_2.test-token', timeframe: 'MAX' },
				'/api/public/tokens/charts/coingecko/wrapped-bitcoin_2.test-token?timeframe=MAX'
			),
			res
		)

		expect(fetchCoinGeckoChartByIdWithCacheFallbackMock).toHaveBeenCalledWith('wrapped-bitcoin_2.test-token', {
			timeframe: 'MAX',
			includeCoinData: false
		})
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ data: { prices: [[1, 2]] } })
	})

	it.each(['24H', '7D'])('loads the canonical %s timeframe', async (timeframe) => {
		fetchCoinGeckoChartByIdWithCacheFallbackMock.mockResolvedValueOnce({ data: { prices: [[1, 2]] } })
		const res = createMockNextApiResponse()

		await handler(
			request({ geckoId: 'bitcoin', timeframe }, `/api/public/tokens/charts/coingecko/bitcoin?timeframe=${timeframe}`),
			res
		)

		expect(fetchCoinGeckoChartByIdWithCacheFallbackMock).toHaveBeenCalledWith('bitcoin', {
			timeframe,
			includeCoinData: false
		})
		expect(res.status).toHaveBeenCalledWith(200)
	})

	it('loads chart metadata only when the caller requests it', async () => {
		fetchCoinGeckoChartByIdWithCacheFallbackMock.mockResolvedValueOnce({ data: { prices: [[1, 2]] } })
		const res = createMockNextApiResponse()

		await handler(
			request(
				{ geckoId: 'bitcoin', timeframe: 'MAX', includeCoinData: 'true' },
				'/api/public/tokens/charts/coingecko/bitcoin?timeframe=MAX&includeCoinData=true'
			),
			res
		)

		expect(fetchCoinGeckoChartByIdWithCacheFallbackMock).toHaveBeenCalledWith('bitcoin', {
			timeframe: 'MAX',
			includeCoinData: true
		})
		expect(res.status).toHaveBeenCalledWith(200)
	})

	it('requires a canonical timeframe for chart requests', async () => {
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'bitcoin' }, '/api/public/tokens/charts/coingecko/bitcoin'), res)

		expect(fetchCoinGeckoChartByIdWithCacheFallbackMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Invalid timeframe parameter' })
	})

	it.each(['10Y', '1D', '1W'])('rejects unsupported %s timeframes before fetching chart data', async (timeframe) => {
		const res = createMockNextApiResponse()

		await handler(
			request({ geckoId: 'bitcoin', timeframe }, `/api/public/tokens/charts/coingecko/bitcoin?timeframe=${timeframe}`),
			res
		)

		expect(fetchCoinGeckoChartByIdWithCacheFallbackMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Invalid timeframe parameter' })
	})

	it('rejects invalid CoinGecko ids before fetching upstream data', async () => {
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'bad id' }, '/api/public/tokens/charts/coingecko/bad%20id'), res)

		expect(fetchCoinGeckoChartByIdWithCacheFallbackMock).not.toHaveBeenCalled()
		expect(fetchCoinGeckoCoinByIdOrThrowMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Invalid geckoId parameter' })
	})

	it('normalizes finite supply values from the CoinGecko coin detail', async () => {
		fetchCoinGeckoCoinByIdOrThrowMock.mockResolvedValueOnce({ market_data: { total_supply: 123 } })
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'aave', kind: 'supply' }, '/api/public/tokens/charts/coingecko/aave'), res)

		expect(fetchCoinGeckoChartByIdWithCacheFallbackMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ totalSupply: 123 })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage='))
	})

	it('returns null supply when the coin detail has no supply value', async () => {
		fetchCoinGeckoCoinByIdOrThrowMock.mockResolvedValueOnce({ market_data: {} })
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'aave', kind: 'supply' }, '/api/public/tokens/charts/coingecko/aave'), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ totalSupply: null })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
	})

	it('returns null supply when the coin detail returns a non-finite supply value', async () => {
		fetchCoinGeckoCoinByIdOrThrowMock.mockResolvedValueOnce({ market_data: { total_supply: Infinity } })
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'aave', kind: 'supply' }, '/api/public/tokens/charts/coingecko/aave'), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ totalSupply: null })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
	})

	it('returns null supply when the coin detail has no market data', async () => {
		fetchCoinGeckoCoinByIdOrThrowMock.mockResolvedValueOnce({})
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'missing', kind: 'supply' }, '/api/public/tokens/charts/coingecko/missing'), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ totalSupply: null })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
		expect(recordRouteRuntimeErrorMock).not.toHaveBeenCalled()
	})

	it('returns null supply when CoinGecko has no coin record', async () => {
		fetchCoinGeckoCoinByIdOrThrowMock.mockRejectedValueOnce(
			new Error('https://api.coingecko.com/api/v3/coins/missing: [404] Not Found')
		)
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'missing', kind: 'supply' }, '/api/public/tokens/charts/coingecko/missing'), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ totalSupply: null })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
		expect(recordRouteRuntimeErrorMock).not.toHaveBeenCalled()
	})

	it('reports CoinGecko failures when loading supply fails', async () => {
		const error = new Error('https://api.coingecko.com/api/v3/coins/aave: [500] Upstream unavailable')
		fetchCoinGeckoCoinByIdOrThrowMock.mockRejectedValueOnce(error)
		const res = createMockNextApiResponse()

		await handler(request({ geckoId: 'aave', kind: 'supply' }, '/api/public/tokens/charts/coingecko/aave'), res)

		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load coingecko chart data' })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
		expect(recordRouteRuntimeErrorMock).toHaveBeenCalledWith(error, 'apiRoute')
	})
})
