import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AUTH_SERVER, POCKETBASE_URL, SERVER_URL } from '~/constants'
import batchHandler from '~/pages/api/private/cex/inflows/batch'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { binanceCexMetadataCache } from './metadataFixture'

const { serve } = installFixtureFetch()
const { seed } = installMetadataSeeder()
beforeEach(() => seed(binanceCexMetadataCache))

describe('cex api', () => {
	test('returns exchange inflows from the real batch route', async () => {
		const api = await import('../api')
		const upstream = { 'binance-cex': { outflows: 100, oldTokens: { tvl: {} }, currentTokens: { tvl: {} } } }
		serve({
			[`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'active' } },
			[`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: { record: { flags: {} } },
			[`${SERVER_URL}/inflows/batch`]: upstream
		})
		// The client proxy posts to our own route; hand that request to the route handler.
		const authorizedFetch = async (_url: string, options?: RequestInit) => {
			const res = createMockNextApiResponse()
			await batchHandler(
				createMockNextApiRequest({
					method: options?.method,
					headers: { authorization: 'Bearer ok' },
					body: JSON.parse(options?.body as string)
				}),
				res
			)
			return Response.json(res.json.mock.lastCall?.[0], { status: res.statusCode })
		}

		await expect(
			api.fetchCexInflowsBatchProxy(
				[{ cexProtocolSlug: 'binance-cex', tokensToExclude: ['BNB', 'BUSD'] }],
				1000,
				5000,
				authorizedFetch
			)
		).resolves.toEqual(upstream)
	})

	test('keeps a failed batch unavailable without issuing per-exchange requests', async () => {
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

	test('splits more than 100 CEXs and merges every successful batch', async () => {
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

	test('keeps all chunked inflows unavailable when one batch fails', async () => {
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
