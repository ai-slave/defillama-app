import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
const database = vi.hoisted(() => ({ any: vi.fn() }))
vi.mock('~/server/db/llama', () => ({ llamaDb: database }))
const http = installFixtureFetch()

import { chainNativeByChainBreakdown } from '../server/chartBuilder/chains'
import { protocolTvlBreakdown, protocolTvlByChainBreakdown } from '../server/chartBuilder/protocols'

beforeEach(() => {
	database.any
		.mockReset()
		.mockResolvedValue([
			{ protocol_slug: 'aave', parent_protocol_slug: null, category: 'Lending', tvl: 2, exclude_tvl_from_parent: false }
		])
})

describe('Pro Dashboard final breakdown response caches', () => {
	test('serializes and reuses the protocol TVL breakdown', async () => {
		http.serve({
			'/lite/protocols2': { protocols: [], parentProtocols: [], chains: [], protocolCategories: [] },
			'/v2/chart/tvl/protocol/aave/chain-breakdown': [[86_400, { Gnosis: 2 }]],
			'/lite/charts/Gnosis': { tvl: [[86_400, 2]] }
		})
		const request = {
			method: 'GET',
			url: '/api/public/pro-dashboard/chart-builder/protocols/breakdowns/tvl?chains=Gnosis',
			query: { chains: 'Gnosis' },
			headers: {}
		}

		const first = await protocolTvlBreakdown.handle(request)
		const sourceRequests = http.requests.length
		const second = await protocolTvlBreakdown.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect('serializedJson' in first ? JSON.parse(first.serializedJson) : first.body).toMatchObject({
			series: [{ data: [[86_400, 2]] }]
		})
		expect(sourceRequests).toBeGreaterThan(0)
		expect(http.requests).toHaveLength(sourceRequests)
		expect(second).toEqual(first)
		expect(database.any).toHaveBeenCalledOnce()
	})

	test('serializes and reuses the protocol TVL by-chain breakdown', async () => {
		http.serve({ '/v2/chart/tvl/protocol/serialized-cache/chain-breakdown': [[86_400, { Ethereum: 2 }]] })
		const request = {
			method: 'GET',
			url: '/api/public/pro-dashboard/chart-builder/protocols/breakdowns/by-chain/tvl?protocol=serialized-cache',
			query: { protocol: 'serialized-cache' },
			headers: {}
		}

		const first = await protocolTvlByChainBreakdown.handle(request)
		const sourceRequests = http.requests.length
		const second = await protocolTvlByChainBreakdown.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect('serializedJson' in first ? JSON.parse(first.serializedJson) : first.body).toMatchObject({
			series: [{ data: [[86_400, 2]] }]
		})
		expect(sourceRequests).toBeGreaterThan(0)
		expect(http.requests).toHaveLength(sourceRequests)
		expect(second).toEqual(first)
	})

	test('serializes and reuses the chain-native by-chain breakdown', async () => {
		http.serve({
			'/v2/metrics/fees': {
				protocols: [
					{
						name: 'Serialized Cache Chain',
						slug: 'serialized-cache-chain',
						protocolType: 'chain',
						total24h: 2
					}
				],
				allChains: []
			}
		})
		http.serve({ '/v2/chart/fees/protocol/serialized-cache-chain': [[86_400, 2]] })
		const request = {
			method: 'GET',
			url: '/api/public/pro-dashboard/chart-builder/chains/breakdowns/by-chain/chain-fees?chains=Serialized%20Cache%20Chain',
			query: { metric: 'chain-fees', chains: 'Serialized Cache Chain' },
			headers: {}
		}

		const first = await chainNativeByChainBreakdown.handle(request)
		const sourceRequests = http.requests.length
		const second = await chainNativeByChainBreakdown.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect('serializedJson' in first ? JSON.parse(first.serializedJson) : first.body).toMatchObject({
			series: [{ data: [[86_400, 2]] }]
		})
		expect(sourceRequests).toBeGreaterThan(0)
		expect(http.requests).toHaveLength(sourceRequests)
		expect(second).toEqual(first)
	})
})
