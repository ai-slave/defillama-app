import { expect, test } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchProDashboardProxy } from '../fetchViaProxy'

const http = installFixtureFetch()
test('returns the data field of a successful proxy response', async () => {
	http.serve({ '/api/private/pro-dashboard/fetch': { data: { name: 'USD Coin' } } })
	await expect(fetchProDashboardProxy('stablecoinAsset', { slug: 'usd coin/€' }, 'secret-token')).resolves.toEqual({
		name: 'USD Coin'
	})
})
test('rejects a failed proxy response without accepting its error body as data', async () => {
	http.serve({ '/api/private/pro-dashboard/fetch': fixtureStatus(401, { error: 'Authentication required' }) })
	await expect(fetchProDashboardProxy('rwaStats', {}, 'expired-token')).rejects.toThrow('Proxy fetch failed: 401')
})
