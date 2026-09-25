import { expect, test } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { fetchProDashboardBridgedTvl } from './fetchBridgedTvl'

const http = installFixtureFetch()
test('loads bridged TVL through the public app route', async () => {
	http.serve({
		'http://localhost:3000/api/public/chains/charts?kind=bridged-tvl&chain=OP+Mainnet': [
			{ timestamp: 1_700_000_000, data: { total: 42 } }
		]
	})
	await expect(fetchProDashboardBridgedTvl('OP Mainnet')).resolves.toEqual([[1_700_000_000, 42]])
})
test('preserves a confirmed empty chart', async () => {
	http.serve({ '/api/public/chains/charts': [] })
	await expect(fetchProDashboardBridgedTvl('Base')).resolves.toEqual([])
})
test('propagates an unavailable response instead of caching a fake empty chart', async () => {
	http.serve({
		'/api/public/chains/charts': fixtureStatus(400, { error: 'Bridged TVL chart is unavailable upstream' })
	})
	await expect(fetchProDashboardBridgedTvl('Base')).rejects.toThrow('Bridged TVL chart is unavailable upstream')
})
