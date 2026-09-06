import { beforeEach, describe, expect, test, vi } from 'vitest'

type FetchWithPoolingOnServer = (typeof import('~/utils/http-client'))['fetchWithPoolingOnServer']

const { pooledFetchMock } = vi.hoisted(() => ({ pooledFetchMock: vi.fn<FetchWithPoolingOnServer>() }))

vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer: pooledFetchMock }))

import { fetchProDashboardProxy } from './fetchViaProxy'

describe('fetchProDashboardProxy', () => {
	beforeEach(() => {
		pooledFetchMock.mockReset()
	})

	test('serializes one exact request parameter and forwards bearer auth', async () => {
		pooledFetchMock.mockResolvedValue(
			new Response(JSON.stringify({ data: { name: 'USD Coin' } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		)

		await fetchProDashboardProxy('stablecoinAsset', { slug: 'usd coin/€' }, 'secret-token')

		const call = pooledFetchMock.mock.calls[0]
		if (!call) throw new Error('Expected a proxy request')
		const [requestInput, requestOptions] = call
		const requestUrl = requestInput instanceof Request ? requestInput.url : requestInput
		const url = new URL(requestUrl, 'https://defillama.test')
		expect(Array.from(url.searchParams.keys())).toEqual(['request'])
		expect(JSON.parse(url.searchParams.get('request') ?? '')).toEqual({
			type: 'stablecoinAsset',
			params: { slug: 'usd coin/€' }
		})
		expect(requestOptions).toEqual({
			headers: { Authorization: 'Bearer secret-token' }
		})
	})

	test('rejects non-success proxy responses without accepting an error body as data', async () => {
		pooledFetchMock.mockResolvedValue(
			new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })
		)

		await expect(fetchProDashboardProxy('rwaStats', {}, 'expired-token')).rejects.toThrow('Proxy fetch failed: 401')
	})
})
