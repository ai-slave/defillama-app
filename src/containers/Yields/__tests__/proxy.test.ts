import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { YIELDS_V2_SERVER_URL } from '~/constants'
import { fetchPoolDetailHistory, fetchBorrowMarketDetailHistory } from '../poolDetail/fetch'
import { fetchStablecoinRatesHistory } from '../rates/fetch'
import { buildYieldsProxyUrl, yieldsProxy } from '../server/proxy'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: unknown[]) => fetchJsonMock(...args)
}))

const fetchMock = vi.fn()

beforeEach(() => {
	fetchJsonMock.mockReset()
	fetchMock.mockReset()
	fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('Yields v2 browser fetches', () => {
	it('routes shared client-side history fetchers through the same-origin proxy', async () => {
		vi.stubGlobal('window', {})

		await fetchPoolDetailHistory('earn/pool', 'max')
		await fetchBorrowMarketDetailHistory('borrow/pool', '90d')
		await fetchStablecoinRatesHistory('30d')

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/yields/proxy/v2/earn/earn%2Fpool/history?range=max',
			'/api/public/yields/proxy/v2/borrow/markets/borrow%2Fpool/history?range=90d',
			'/api/public/yields/proxy/v2/reference-rates/stablecoins/history?range=30d'
		])
	})

	it('keeps SSR requests on the direct keyed upstream', async () => {
		await fetchPoolDetailHistory('pool', 'max')

		expect(fetchMock).toHaveBeenCalledOnce()
		expect(fetchMock.mock.calls[0]?.[0]).toBe(`${YIELDS_V2_SERVER_URL}/v2/earn/pool/history?range=max`)
	})
})

describe('Yields v2 proxy mapping', () => {
	it('maps the allowlisted history routes to the direct upstream', () => {
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', 'earn/pool', 'history'], range: 'max' })).toBe(
			`${YIELDS_V2_SERVER_URL}/v2/earn/earn%2Fpool/history?range=max`
		)
		expect(buildYieldsProxyUrl({ path: ['v2', 'borrow', 'markets', 'pool', 'history'], range: '90d' })).toBe(
			`${YIELDS_V2_SERVER_URL}/v2/borrow/markets/pool/history?range=90d`
		)
		expect(buildYieldsProxyUrl({ path: ['v2', 'reference-rates', 'stablecoins', 'history'], range: '30d' })).toBe(
			`${YIELDS_V2_SERVER_URL}/v2/reference-rates/stablecoins/history?range=30d`
		)
		expect(buildYieldsProxyUrl({ path: ['v2', 'protocol-median', 'Aave V3', 'history'] })).toBe(
			`${YIELDS_V2_SERVER_URL}/v2/protocol-median/Aave%20V3/history`
		)
	})

	it('rejects unrelated endpoints and invalid ranges before fetching upstream', async () => {
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn'] })).toBeNull()
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', 'pool', 'history'], range: '1y' })).toBeNull()

		const result = await yieldsProxy.handle({
			method: 'GET',
			url: '/api/public/yields/proxy/v2/earn',
			query: { path: ['v2', 'earn'] },
			headers: {}
		})

		expect(result).toEqual({ status: 400, body: { error: 'Invalid Yields proxy request' } })
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})
})
