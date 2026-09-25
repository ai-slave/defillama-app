import { expect, test } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { fetchProDashboardProxy } from './fetchViaProxy'

const http = installFixtureFetch()
test('serializes one exact request parameter and sends bearer auth', async () => {
	http.serve({ '/api/private/pro-dashboard/fetch': { data: { name: 'USD Coin' } } })
	await expect(fetchProDashboardProxy('stablecoinAsset', { slug: 'usd coin/€' }, 'secret-token')).resolves.toEqual({
		name: 'USD Coin'
	})
	const { url, init } = http.requests[0]
	expect([...url.searchParams.keys()]).toEqual(['request'])
	expect(JSON.parse(url.searchParams.get('request')!)).toEqual({
		type: 'stablecoinAsset',
		params: { slug: 'usd coin/€' }
	})
	expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer secret-token')
})
test('rejects a failed proxy response without accepting its error body as data', async () => {
	http.serve({ '/api/private/pro-dashboard/fetch': fixtureStatus(401, { error: 'Authentication required' }) })
	await expect(fetchProDashboardProxy('rwaStats', {}, 'expired-token')).rejects.toThrow('Proxy fetch failed: 401')
})
