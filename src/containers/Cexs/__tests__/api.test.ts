import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	serverUrl: 'https://api.example.com'
}))

vi.mock('~/constants', () => ({
	get SERVER_URL() {
		return mocks.serverUrl
	}
}))

vi.mock('~/utils/async', () => ({
	fetchJson: mocks.fetchJson
}))

beforeEach(() => {
	mocks.fetchJson.mockReset()
	mocks.fetchJson.mockResolvedValue(null)
})

describe('cex api', () => {
	it('requests exchange inflows through the batch proxy', async () => {
		const api = await import('../api')
		const response = {
			'binance-cex': { outflows: 100, oldTokens: { tvl: {} }, currentTokens: { tvl: {} } }
		}
		const authorizedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)))

		await expect(
			api.fetchCexInflowsBatchProxy(
				[{ cexProtocolSlug: 'binance-cex', tokensToExclude: ['BNB', 'BUSD'] }],
				1000,
				5000,
				authorizedFetch
			)
		).resolves.toEqual(response)

		expect(authorizedFetch).toHaveBeenCalledWith('/api/private/cex/inflows/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: ['BNB', 'BUSD'] }],
				start: 1000,
				end: 5000
			})
		})
	})

	it('keeps a failed batch unavailable without issuing per-exchange requests', async () => {
		const api = await import('../api')
		const authorizedFetch = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ error: 'not found' }), { status: 404 }))

		await expect(
			api.fetchCexInflowsBatchProxy(
				[
					{ cexProtocolSlug: 'binance-cex', tokensToExclude: ['BNB'] },
					{ cexProtocolSlug: 'okx', tokensToExclude: ['OKB'] }
				],
				1000,
				5000,
				authorizedFetch
			)
		).rejects.toThrow('Inflows batch API returned 404')

		expect(authorizedFetch).toHaveBeenCalledTimes(1)
	})

	it('splits more than 100 CEXs and merges every successful batch', async () => {
		const api = await import('../api')
		const cexs = Array.from({ length: 101 }, (_, index) => ({
			cexProtocolSlug: `cex-${index}`,
			tokensToExclude: []
		}))
		const firstResponse = {
			'cex-0': { outflows: 100, oldTokens: { tvl: {} }, currentTokens: { tvl: {} } }
		}
		const secondResponse = {
			'cex-100': { outflows: 0, oldTokens: { tvl: {} }, currentTokens: { tvl: {} } }
		}
		const authorizedFetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(firstResponse)))
			.mockResolvedValueOnce(new Response(JSON.stringify(secondResponse)))

		await expect(api.fetchCexInflowsBatchProxy(cexs, 1000, 5000, authorizedFetch)).resolves.toEqual({
			...firstResponse,
			...secondResponse
		})

		expect(authorizedFetch).toHaveBeenCalledTimes(2)
		expect(authorizedFetch).toHaveBeenNthCalledWith(1, '/api/private/cex/inflows/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cexs: cexs.slice(0, 100), start: 1000, end: 5000 })
		})
		expect(authorizedFetch).toHaveBeenNthCalledWith(2, '/api/private/cex/inflows/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cexs: cexs.slice(100), start: 1000, end: 5000 })
		})
	})

	it('keeps all chunked inflows unavailable when one batch fails', async () => {
		const api = await import('../api')
		const cexs = Array.from({ length: 101 }, (_, index) => ({
			cexProtocolSlug: `cex-${index}`,
			tokensToExclude: []
		}))
		const authorizedFetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({})))
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'failed' }), { status: 502 }))

		await expect(api.fetchCexInflowsBatchProxy(cexs, 1000, 5000, authorizedFetch)).rejects.toThrow(
			'Inflows batch API returned 502'
		)
		expect(authorizedFetch).toHaveBeenCalledTimes(2)
	})
})
