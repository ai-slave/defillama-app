import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { YIELDS_V2_SERVER_URL } from '~/constants'
import { fetchPoolDetail, fetchPoolDetailHistory, fetchBorrowMarketDetailHistory } from '../poolDetail/fetch'
import { fetchStablecoinRatesHistory } from '../rates/fetch'
import { buildYieldsProxyUrl, yieldsProxy } from '../server/proxy'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: Array<unknown>) => fetchJsonMock(...args)
}))

const fetchMock = vi.fn()
const POOL_ID = '79e042b5-e55d-4a4e-b0b0-6661a570470b'

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
	test('routes shared client-side history fetchers through the same-origin proxy', async () => {
		vi.stubGlobal('window', {})

		await fetchPoolDetailHistory(POOL_ID, 'max')
		await fetchBorrowMarketDetailHistory('borrow/pool', '90d')
		await fetchStablecoinRatesHistory('30d')

		// No measured leg from the browser: it reaches the private routes instead, and the public
		// proxy refuses to front the verified endpoints at all.
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			`/api/public/yields/proxy/v2/earn/${POOL_ID}/history?range=max`,
			'/api/public/yields/proxy/v2/borrow/markets/borrow%2Fpool/history?range=90d',
			'/api/public/yields/proxy/v2/reference-rates/stablecoins/history?range=30d'
		])
	})

	test('routes the earn detail fetch through the proxy in the browser', async () => {
		vi.stubGlobal('window', {})

		await fetchPoolDetail(POOL_ID)

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`/api/public/yields/proxy/v2/earn/${POOL_ID}`])
	})

	test('keeps SSR requests on the direct keyed upstream', async () => {
		await fetchPoolDetailHistory('pool', 'max')

		expect(fetchMock).toHaveBeenCalledOnce()
		expect(fetchMock.mock.calls[0]?.[0]).toBe(`${YIELDS_V2_SERVER_URL}/v2/earn/pool/history?range=max`)
	})

	test('does not request the verified sidecar unless the caller opts in', async () => {
		await fetchPoolDetailHistory(POOL_ID, 'max')

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			`${YIELDS_V2_SERVER_URL}/v2/earn/${POOL_ID}/history?range=max`
		])

		fetchMock.mockClear()
		await fetchPoolDetailHistory(POOL_ID, 'max', { includeVerified: true })

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			`${YIELDS_V2_SERVER_URL}/v2/earn/${POOL_ID}/history?range=max`,
			`${YIELDS_V2_SERVER_URL}/v2/earn/verified/${POOL_ID}/history?range=max`
		])
	})

	// Only ~262 of ~17k pools are measured, so a 404 on the verified leg is the ordinary case and
	// must leave the reported payload intact rather than failing the page.
	test('keeps the reported payload when the pool has no measurement', async () => {
		fetchMock.mockReset()
		fetchMock.mockImplementation((url: string) =>
			url.includes('/verified/')
				? Promise.resolve({ ok: false, status: 404 })
				: Promise.resolve({ ok: true, json: async () => ({ data: [{ date: '2026-08-28', tvl_usd: 42 }] }) })
		)

		await expect(fetchPoolDetailHistory(POOL_ID, '30d', { includeVerified: true })).resolves.toEqual([
			{ date: '2026-08-28', tvl_usd: 42 }
		])
	})
})

describe('Yields v2 proxy mapping', () => {
	test('maps the allowlisted history routes to the direct upstream', () => {
		// Earn ids are pool config UUIDs only, so encoding is exercised on the borrow path below.
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', POOL_ID, 'history'], range: 'max' })).toBe(
			`${YIELDS_V2_SERVER_URL}/v2/earn/${POOL_ID}/history?range=max`
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
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', POOL_ID] })).toBe(`${YIELDS_V2_SERVER_URL}/v2/earn/${POOL_ID}`)
	})

	test('rejects unrelated endpoints and invalid ranges before fetching upstream', async () => {
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn'] })).toBeNull()
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', 'pool', 'history'], range: '1y' })).toBeNull()
		// The measured list collides with the earn-detail shape and must never be proxied.
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', 'verified'] })).toBeNull()
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', 'trends'] })).toBeNull()
		expect(buildYieldsProxyUrl({ path: ['v2', 'earn', 'history'] })).toBeNull()

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

// Public and CDN-cached, so it must never emit a measurement — detail is the only response
// anywhere that carries `verified.methods`.
describe('verified redaction', () => {
	const call = (path: Array<string>) =>
		yieldsProxy.handle({ method: 'GET', url: `/x/${path.join('/')}`, query: { path }, headers: {} })

	test('strips the block from an earn detail response', async () => {
		fetchJsonMock.mockResolvedValue({
			data: { id: POOL_ID, verified: { apy: { avg_1d: 2.58 }, confidence: 'high', methods: ['balanceOf(holder)'] } }
		})

		const body = JSON.stringify(await call(['v2', 'earn', POOL_ID]))

		expect(body).not.toContain('balanceOf')
		expect(body).not.toContain('2.58')
		expect(body).toContain('verified_locked')
	})

	test('strips every measured day from history, keeping the reported series', async () => {
		fetchJsonMock.mockResolvedValue({
			data: [{ date: '2026-08-28', tvl_usd: 42, verified: { price_per_share: 1.1049 } }]
		})

		const body = JSON.stringify(await call(['v2', 'earn', POOL_ID, 'history']))

		expect(body).not.toContain('1.1049')
		expect(body).toContain('2026-08-28')
	})

	test('never object-spreads an unexpected array returned for a detail route', async () => {
		const arrayPoolId = '79e042b5-e55d-4a4e-b0b0-6661a570470c'
		fetchJsonMock.mockResolvedValue({ data: [{ id: arrayPoolId }] })

		const result = await call(['v2', 'earn', arrayPoolId])
		const payload = JSON.parse((result as { serializedJson: string }).serializedJson) as { data: unknown }

		expect(Array.isArray(payload.data)).toBe(true)
	})
})
