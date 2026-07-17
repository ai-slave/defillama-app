import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/constants')>()
	return { ...actual, MARKETS_SERVER_URL: 'https://master-routes.example.com' }
})

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return { ...actual, fetchJson: fetchJsonMock }
})

beforeEach(() => vi.clearAllMocks())

describe('master Exchanges API routes', () => {
	it('loads global chart parts independently', async () => {
		const { masterExchangeChart } = await import('../server/master.api')
		fetchJsonMock.mockImplementation(async (url: string) => ({ url }))
		const request = { method: 'GET', url: '/api/public/exchanges/charts', headers: {} }

		await masterExchangeChart.handle({ ...request, query: { part: 'volume' } })
		await masterExchangeChart.handle({ ...request, query: { part: 'oi' } })
		const invalid = await masterExchangeChart.handle({ ...request, query: { part: 'future-shape' } })

		expect(fetchJsonMock).toHaveBeenCalledTimes(2)
		expect(fetchJsonMock).toHaveBeenCalledWith('https://master-routes.example.com/charts/volume.json', {
			timeout: 60_000
		})
		expect(fetchJsonMock).toHaveBeenCalledWith('https://master-routes.example.com/charts/oi.json', {
			timeout: 60_000
		})
		expect(invalid).toEqual({ status: 400, body: { error: 'Unknown exchange chart' } })
	})

	it('loads per-venue history from its own columnar series file', async () => {
		const { masterExchangeHistory } = await import('../server/master.api')
		fetchJsonMock.mockImplementation(async (url: string) => ({
			url,
			days: [1, 3],
			key: ['spot_volume', 'linear_perp_volume'],
			series: [[10, 30], null],
			last_updated: '2026-07-13T00:00:00Z'
		}))
		const request = { method: 'GET', url: '/api/public/exchanges/history', headers: {} }

		const binance = await masterExchangeHistory.handle({ ...request, query: { exchange: 'binance' } })

		expect(fetchJsonMock).toHaveBeenCalledWith('https://master-routes.example.com/exchanges/binance/series.json')
		expect('serializedJson' in binance && JSON.parse(binance.serializedJson)).toMatchObject({
			days: [1, 3],
			series: { spot_volume: [10, 30] }
		})
	})

	it('rejects noncanonical exchange slugs instead of rewriting them', async () => {
		const { masterExchangeHistory } = await import('../server/master.api')
		const request = { method: 'GET', url: '/api/public/exchanges/history', headers: {} }

		const response = await masterExchangeHistory.handle({ ...request, query: { exchange: 'coinbase--eu' } })

		expect(response).toEqual({ status: 400, body: { error: 'Invalid exchange' } })
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})

	it('uses the canonical client slug unchanged for venue history', async () => {
		const { fetchExchangeVenueSeries } = await import('../master.api')
		fetchJsonMock.mockResolvedValue({})

		await fetchExchangeVenueSeries('coinbase-eu')

		expect(fetchJsonMock).toHaveBeenCalledWith('/api/public/exchanges/coinbase-eu/history')
	})
})
