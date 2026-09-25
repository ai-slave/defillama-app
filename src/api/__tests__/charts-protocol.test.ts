import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test } from 'vitest'
import { BRIDGES_SERVER_URL, RWA_SERVER_URL, V2_SERVER_URL, YIELDS_V2_SERVER_URL } from '~/constants'
import handler from '~/pages/api/public/protocols/charts'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

const { serve, urls } = installFixtureFetch()
const { seed } = installMetadataSeeder()

async function run(query: NextApiRequest['query'], method = 'GET') {
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method, query }), res)
	return { status: res.statusCode, body: res.json.mock.lastCall?.[0] }
}

beforeEach(() => {
	seed({
		protocolMetadata: { '1': { name: 'Aave', displayName: 'Aave' }, 'cex-1': { name: 'Binance', cex: true } },
		protocolRouteIdBySlug: { aave: '1', 'aave-v3': '1' },
		cexRouteIdBySlug: { binance: 'cex-1' },
		bridgeProtocolSlugsSet: new Set(['stargate']),
		oracleRoutes: { oracleNameBySlug: { chainlink: 'Chainlink' }, chainNameBySlug: {}, chainSlugsByOracleSlug: {} }
	})
})

describe('/api/public/protocols/charts', () => {
	test('prefers protocol-issued RWA assets over the parent platform', async () => {
		serve({ [`${RWA_SERVER_URL}/protocol/child/mcap/chart`]: [[1, 42]] })
		expect(await run({ kind: 'rwa-aum', rwaProtocol: 'child', platform: 'parent' })).toEqual({
			status: 200,
			body: [[1, 42]]
		})
	})

	test('rejects an RWA chart request without either source', async () => {
		expect((await run({ kind: 'rwa-aum' })).status).toBe(400)
		expect(urls()).toEqual([])
	})

	test('distinguishes an empty RWA history from an upstream failure', async () => {
		serve({ [`${RWA_SERVER_URL}/protocol/child/mcap/chart`]: [] })
		expect(await run({ kind: 'rwa-aum', rwaProtocol: 'child' })).toEqual({ status: 200, body: [] })
		serve({ [`${RWA_SERVER_URL}/protocol/child/mcap/chart`]: fixtureStatus(500) })
		expect(await run({ kind: 'rwa-aum', rwaProtocol: 'child' })).toEqual({
			status: 500,
			body: { error: 'Failed to load protocol chart data' }
		})
	})

	test('rejects unknown kinds and the POST transport without calling upstream', async () => {
		expect(await run({ kind: 'governance' })).toEqual({ status: 400, body: { error: 'Unsupported kind: governance' } })
		expect((await run({ kind: 'tvl', protocol: 'Aave V3' }, 'POST')).status).toBe(405)
		expect(urls()).toEqual([])
	})

	test.each([
		{
			kind: 'tvl',
			query: { key: 'pool2', tokensToExclude: 'GT,MNT' },
			suffix: '?key=pool2&tokensToExclude=GT%2CMNT',
			value: 12
		},
		{
			kind: 'tvl',
			query: { key: 'borrowed', breakdownType: 'chain-breakdown' },
			suffix: '/chain-breakdown?key=borrowed',
			value: { Ethereum: 12 }
		},
		{
			kind: 'tvl',
			query: { key: 'staking', currency: 'token', breakdownType: 'token-breakdown' },
			suffix: '/token-breakdown?key=staking&currency=token',
			value: { AAVE: 12 }
		},
		{ kind: 'treasury', query: { key: 'OwnTokens' }, suffix: '?key=OwnTokens', value: 24 },
		{
			kind: 'treasury',
			query: { currency: 'usd', breakdownType: 'token-breakdown' },
			suffix: '/token-breakdown?currency=usd',
			value: { AAVE: 24 }
		}
	])('returns $kind $suffix with millisecond timestamps', async ({ kind, query, suffix, value }) => {
		serve({ [`${V2_SERVER_URL}/chart/${kind}/protocol/aave${suffix}`]: [[1_700_000_000, value]] })
		expect(await run({ kind, protocol: 'Aave V3', ...query })).toEqual({
			status: 200,
			body: [[1_700_000_000_000, value]]
		})
	})

	test('returns 404 for unknown protocols', async () => {
		expect(await run({ kind: 'treasury', protocol: 'missing' })).toEqual({
			status: 404,
			body: { error: 'protocol not found' }
		})
	})

	test.each([
		['tvl', { key: 'doublecounted' }, 'Invalid tvl key: doublecounted'],
		['tvl', { key: 'liquidstaking' }, 'Invalid tvl key: liquidstaking'],
		['tvl', { key: 'govtokens' }, 'Invalid tvl key: govtokens'],
		['treasury', { key: 'ownTokens' }, 'Invalid treasury key: ownTokens'],
		['tvl', { breakdownType: 'chain' }, 'Invalid breakdownType: chain'],
		['tvl', { currency: 'token' }, 'currency is only supported for token-breakdown charts'],
		['treasury', { tokensToExclude: 'AAVE' }, 'tokensToExclude is only supported for tvl charts']
	])('rejects unsupported %s chart request combinations', async (kind, query, error) => {
		expect(await run({ kind, protocol: 'Aave', ...query })).toEqual({ status: 400, body: { error } })
		expect(urls()).toEqual([])
	})

	test('resolves CEX names to their asset chart', async () => {
		serve({ [`${V2_SERVER_URL}/chart/tvl/protocol/binance`]: [[1_700_000_000, 42]] })
		expect(await run({ kind: 'tvl', protocol: 'Binance' })).toEqual({ status: 200, body: [[1_700_000_000_000, 42]] })
	})

	test.each([
		['median-apy', 'aave-v3', `${YIELDS_V2_SERVER_URL}/v2/protocol-median/aave-v3/history`, { data: [] }],
		['bridge-volume', 'Stargate', `${BRIDGES_SERVER_URL}/bridgevolume/slug/stargate`, { bridge: {}, dailyVolumes: [] }],
		['oracle-chart', 'Chainlink', `${V2_SERVER_URL}/chart/oracle/protocol/chainlink`, []]
	] as const)('distinguishes empty %s charts from producer failures', async (kind, protocol, url, body) => {
		serve({ [url]: body })
		expect(await run({ kind, protocol })).toEqual({ status: 200, body: [] })
		serve({ [url]: fixtureStatus(400) })
		expect(await run({ kind, protocol })).toEqual({
			status: 500,
			body: { error: 'Failed to load protocol chart data' }
		})
	})
})
