import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AUTH_SERVER, DATASETS_SERVER_URL, POCKETBASE_URL, SERVER_URL } from '~/constants'
import handler from '~/pages/api/private/token-unlocks/[protocol]'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { serve } = installFixtureFetch()
const { seed } = installMetadataSeeder()
beforeEach(() => {
	// Development without an API key keeps the background metadata refresher from replacing the seeded cache.
	vi.stubEnv('NODE_ENV', 'development')
	vi.stubEnv('API_KEY', '')
	seed({
		protocolMetadata: { aave: { name: 'aave', displayName: 'Aave' } },
		protocolRouteIdBySlug: { aave: 'aave', 'aave-alias': 'aave' },
		emissionsProtocolBySlug: { aave: 'aave', 'aave-alias': 'aave-alias', nvda: 'nvda' },
		tokenlist: {}
	})
	serve({
		[`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'active' } },
		[`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: { record: { flags: {} } },
		[`${SERVER_URL}/emissions`]: []
	})
})
afterEach(() => vi.unstubAllEnvs())

async function run(query: NextApiRequest['query'], auth: string | null = 'Bearer ok', method = 'GET') {
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method, query, headers: { authorization: auth ?? undefined } }), res)
	expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
	return { status: res.statusCode, body: res.json.mock.lastCall?.[0] }
}

const emission = {
	name: 'Aave',
	gecko_id: null,
	pId: 'aave',
	defillamaIds: ['aave'],
	chainName: 'Ethereum',
	metadata: { token: '', protocolIds: ['aave'], events: [], unlockEvents: [] },
	documentedData: { data: [], tokenAllocation: { investors: null, insiders: null, nonInsiders: null } },
	categories: {},
	unlockUsdChart: []
}

describe('private token unlocks route', () => {
	test('rejects unsupported methods', async () => {
		expect((await run({}, null, 'POST')).status).toBe(405)
	})
	test('authenticates before revealing parameter errors or missing protocols', async () => {
		expect(await run({}, null)).toEqual({ status: 401, body: { error: 'Authentication required' } })
		serve({ [`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'inactive' } } })
		expect(await run({ protocol: 'missing' })).toEqual({ status: 403, body: { error: 'Active subscription required' } })
	})
	test('validates protocol parameters for subscribed callers', async () => {
		expect(await run({})).toEqual({ status: 400, body: { error: 'Missing protocol parameter' } })
		expect(await run({ protocol: 'missing' })).toEqual({ status: 404, body: { error: 'Protocol emissions not found' } })
	})
	test('prefers the canonical protocol over a matching emissions alias', async () => {
		serve({
			[`${DATASETS_SERVER_URL}/emissions/aave`]: emission,
			[`${DATASETS_SERVER_URL}/emissions/aave-alias`]: { ...emission, name: 'Aave alias file' }
		})
		const response = await run({ protocol: 'aave-alias' })
		expect(response.status).toBe(200)
		expect(response.body).toMatchObject({ name: 'Aave', events: [], chartData: { documented: [], realtime: [] } })
	})
	test('accepts equity tickers directly from the emissions index', async () => {
		serve({ [`${DATASETS_SERVER_URL}/emissions/nvda`]: { ...emission, name: 'NVIDIA' } })
		expect(await run({ protocol: 'NVDA' })).toMatchObject({ status: 200, body: { name: 'NVIDIA' } })
	})
	test('distinguishes a missing schedule from an upstream failure', async () => {
		serve({ [`${DATASETS_SERVER_URL}/emissions/aave`]: fixtureStatus(404) })
		expect((await run({ protocol: 'aave' })).status).toBe(404)
		serve({ [`${DATASETS_SERVER_URL}/emissions/aave`]: fixtureStatus(400) })
		expect(await run({ protocol: 'aave' })).toEqual({ status: 500, body: { error: 'Internal server error' } })
	})
	test('reports authentication service failures', async () => {
		serve({
			[`${AUTH_SERVER}/subscription/status`]: () => {
				throw new Error('Auth unavailable')
			}
		})
		expect((await run({ protocol: 'aave' })).status).toBe(500)
	})
})
