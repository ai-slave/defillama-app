import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test } from 'vitest'
import { BRIDGES_SERVER_URL, DATASETS_SERVER_URL, SERVER_URL, STABLECOINS_SERVER_URL, V2_SERVER_URL } from '~/constants'
import handler from '~/pages/api/public/chains/charts'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

const { serve, urls } = installFixtureFetch()
const { seed } = installMetadataSeeder()
beforeEach(() =>
	seed({
		protocolMetadata: { aave: { name: 'aave', displayName: 'Aave' } },
		protocolRouteIdBySlug: { aave: 'aave', 'aave-v3': 'aave' },
		chainMetadata: {
			base: { name: 'Base', id: 'base', chainFees: true, chainRevenue: true, chainHoldersRevenue: true }
		},
		chainRouteKeyBySlug: { base: 'base' },
		emissionsProtocolBySlug: { aave: 'aave' }
	})
)
async function run(query: NextApiRequest['query']) {
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method: 'GET', query }), res)
	return {
		status: res.statusCode,
		body: res.json.mock.lastCall?.[0],
		cache: res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]
	}
}

describe('public chain charts', () => {
	test('resolves protocol aliases to the canonical adapter chart', async () => {
		serve({ [`${V2_SERVER_URL}/chart/fees/protocol/aave`]: [[1, 42]] })
		expect(await run({ kind: 'adapter-protocol', adapterType: 'fees', protocol: 'Aave V3' })).toMatchObject({
			status: 200,
			body: [[1, 42]]
		})
		expect(urls()).toEqual([`${V2_SERVER_URL}/chart/fees/protocol/aave`])
	})
	test.each([
		['chainFees', undefined],
		['chainRevenue', 'dailyRevenue'],
		['chainHoldersRevenue', 'dailyHoldersRevenue']
	] as const)('requires the %s flag for native chain fee metrics', async (flag, dataType) => {
		const query = { kind: 'adapter-protocol', adapterType: 'fees', protocol: 'Base', dataType }
		const url = `${V2_SERVER_URL}/chart/fees/protocol/base${dataType ? `?dataType=${dataType}` : ''}`
		serve({ [url]: [[1, 42]] })
		expect(await run({ ...query, entity: 'chain' })).toMatchObject({ status: 200, body: [[1, 42]] })
		expect(await run(query)).toMatchObject({ status: 200, body: [[1, 42]] })
		expect((await run({ ...query, entity: 'protocol' })).status).toBe(404)
		seed({ chainMetadata: { base: { name: 'Base', id: 'base', [flag]: false } } })
		expect((await run({ ...query, entity: 'chain' })).status).toBe(404)
	})
	test('rejects holders revenue for a chain that has chain revenue but no holder series', async () => {
		seed({ chainMetadata: { base: { name: 'Base', id: 'base', chainFees: true, chainRevenue: true } } })
		const responses = await Promise.all(
			['chain', undefined].map((entity) =>
				run({
					kind: 'adapter-protocol',
					adapterType: 'fees',
					dataType: 'dailyHoldersRevenue',
					protocol: 'Base',
					entity
				})
			)
		)
		expect(responses.map((response) => response.status)).toEqual([404, 404])
	})
	test.each(['dailyAppFees', 'dailyAppRevenue'])('does not treat %s as native chain revenue', async (dataType) => {
		const responses = await Promise.all(
			['chain', undefined].map((entity) =>
				run({ kind: 'adapter-protocol', adapterType: 'fees', dataType, protocol: 'Base', entity })
			)
		)
		expect(responses.map((response) => response.status)).toEqual([404, 404])
	})
	test.each([
		['active-users', undefined],
		['new-users', undefined],
		['active-users', 'dailyTransactionsCount']
	])('accepts %s %s only with an explicit chain entity', async (adapterType, dataType) => {
		serve({
			[`${V2_SERVER_URL}/chart/${adapterType}/protocol/base${dataType ? `?dataType=${dataType}` : ''}`]: [[1, 42]]
		})
		const query = { kind: 'adapter-protocol', adapterType, dataType, protocol: 'Base' }
		expect(await run({ ...query, entity: 'chain' })).toMatchObject({ status: 200, body: [[1, 42]] })
		expect((await run(query)).status).toBe(404)
	})
	test('rejects unsupported adapters, unknown protocols, and aggregate native protocol charts', async () => {
		expect((await run({ kind: 'adapter-chain', adapterType: 'missing', chain: 'Base' })).status).toBe(400)
		const responses = await Promise.all(
			['missing', 'all'].map((protocol) =>
				run({ kind: 'adapter-protocol', adapterType: 'fees', protocol, entity: 'chain' })
			)
		)
		expect(responses.map((response) => response.status)).toEqual([404, 404])
		expect(
			(
				await run({
					kind: 'adapter-protocol',
					adapterType: 'active-users',
					dataType: 'dailyGasUsed',
					protocol: 'Base',
					entity: 'chain'
				})
			).status
		).toBe(404)
	})
	test.each([
		['Hyperliquid L1', 'hyperliquid'],
		['OP Mainnet', 'optimism'],
		['Avalanche', 'avax'],
		['Gnosis', 'xdai'],
		['ZKsync Era', 'era']
	])('uses the producer identifier for %s bridged TVL', async (name, id) => {
		const route = name.toLowerCase().replaceAll(' ', '-')
		seed({ chainMetadata: { [id]: { id, name, chainAssets: true } }, chainRouteKeyBySlug: { [route]: id } })
		serve({ [`${SERVER_URL}/chain-assets/chart/${id}`]: [{ timestamp: 1_700_000_000, data: { total: '100' } }] })
		expect(await run({ kind: 'bridged-tvl', chain: name })).toMatchObject({
			status: 200,
			body: [{ timestamp: 1_700_000_000, data: { total: 100 } }]
		})
	})
	test('distinguishes unsupported bridged TVL from an unavailable producer', async () => {
		const responses = await Promise.all(['base', 'all'].map((chain) => run({ kind: 'bridged-tvl', chain })))
		expect(responses.map((response) => response.status)).toEqual([404, 404])
		seed({ chainMetadata: { base: { id: 'base', name: 'Base', chainAssets: true } } })
		serve({ [`${SERVER_URL}/chain-assets/chart/base`]: fixtureStatus(400) })
		expect(await run({ kind: 'bridged-tvl', chain: 'base' })).toMatchObject({
			status: 502,
			body: { error: 'Bridged TVL chart is unavailable upstream' },
			cache: 'no-store'
		})
	})
	test('preserves missing bridge legs and zero while making withdrawals negative', async () => {
		serve({
			[`${BRIDGES_SERVER_URL}/bridgevolume/Base`]: [
				{ date: '1700000000', depositUSD: 100, withdrawUSD: 40, depositTxs: 2, withdrawTxs: 1 },
				{ date: '1700086400', depositUSD: null, withdrawUSD: 4, depositTxs: 0, withdrawTxs: 1 },
				{ date: '1700172800', depositUSD: 0, withdrawUSD: 0, depositTxs: 0, withdrawTxs: 0 },
				{ date: '1700259200', depositUSD: null, withdrawUSD: null, depositTxs: 0, withdrawTxs: 0 }
			]
		})
		expect(await run({ kind: 'net-inflows', chain: 'base' })).toMatchObject({
			status: 200,
			body: [
				[1_700_000_000, 100, -40],
				[1_700_086_400, null, -4],
				[1_700_172_800, 0, 0],
				[1_700_259_200, null, null]
			]
		})
	})
	test.each([
		{
			chart: [
				[100, 0],
				[200, 5],
				[500, 7],
				[600, 0]
			],
			expected: [
				[200, 5],
				[500, 7],
				[600, 0]
			]
		},
		{ chart: [], expected: [] },
		{
			chart: [
				[100, 0],
				[200, 0]
			],
			expected: [
				[100, 0],
				[200, 0]
			]
		}
	])('trims only leading zero incentives when a positive point exists: $chart', async ({ chart, expected }) => {
		serve({
			[`${DATASETS_SERVER_URL}/emissions/aave`]: { metadata: { events: [], unlockEvents: [] }, unlockUsdChart: chart }
		})
		const response = await run({ kind: 'token-incentives', protocol: 'aave' })
		expect(response).toMatchObject({ status: 200, body: expected })
		expect(response.cache).toContain('s-maxage=')
	})
	test('serves the default TVL and its setting series in ms for a chain and for all chains, and refuses an unknown chain', async () => {
		serve({
			[`${SERVER_URL}/lite/charts/Base`]: { tvl: [[1_700_000_000, 10]], staking: [[1_700_000_000, 2.7]] },
			[`${SERVER_URL}/lite/charts`]: { tvl: [[1_700_000_000, 10]], borrowed: [[1_700_000_000, 5]] }
		})

		const base = await run({ kind: 'extra-tvl', chain: 'base' })
		expect(base.status).toBe(200)
		expect(base.body.tvlChart).toEqual([[1_700_000_000_000, 10]])
		expect(base.body.extraTvlCharts.staking).toEqual({ 1_700_000_000_000: 2 })
		expect(base.body.extraTvlCharts.borrowed).toEqual({})
		expect((await run({ kind: 'extra-tvl', chain: 'All' })).body.extraTvlCharts.borrowed).toEqual({
			1_700_000_000_000: 5
		})
		expect((await run({ kind: 'extra-tvl', chain: 'nowhere' })).status).toBe(404)
	})
	test('accepts lowercase all for aggregate adapter charts', async () => {
		serve({ [`${V2_SERVER_URL}/chart/fees`]: [[1, 42]] })
		expect(await run({ kind: 'adapter-chain', adapterType: 'fees', chain: 'all' })).toMatchObject({
			status: 200,
			body: [[1, 42]]
		})
	})
	test('preserves measured zero stablecoin market cap rows', async () => {
		serve({
			[`${STABLECOINS_SERVER_URL}/stablecoins`]: {
				peggedAssets: [
					{ id: '1', name: 'Tether', symbol: 'USDT', chains: [], pegType: 'peggedUSD', pegMechanism: 'fiat-backed' }
				],
				chains: []
			},
			[`${STABLECOINS_SERVER_URL}/stablecoincharts2/all`]: {
				breakdown: {
					'1': [
						{ date: '1699913600', totalCirculatingUSD: { peggedUSD: 10 } },
						{ date: '1700086400', totalCirculatingUSD: { peggedUSD: 0 } }
					]
				},
				doublecountedIds: []
			}
		})
		expect(await run({ kind: 'stablecoins-mcap', chain: 'all' })).toMatchObject({
			status: 200,
			body: [
				[1_699_913_600_000, 10],
				[1_700_086_400_000, 0]
			]
		})
	})
	test('normalizes raise amounts to USD, aggregates dates, and preserves a measured zero', async () => {
		serve({
			[`${SERVER_URL}/raises`]: {
				raises: [
					{ date: 3, amount: 0, valuation: null },
					{ date: 2, amount: 4, valuation: null },
					{ date: 1, amount: 3, valuation: null },
					{ date: 2, amount: 1, valuation: null }
				]
			}
		})
		expect(await run({ kind: 'raises' })).toMatchObject({
			status: 200,
			body: [
				[1000, 3_000_000],
				[2000, 5_000_000],
				[3000, 0]
			]
		})
	})
})
