import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
	protocolTvlBreakdown,
	protocolTvlByChainBreakdown
} from '~/containers/ProDashboard/server/chartBuilder/protocols'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'

vi.mock('~/server/db/llama', () => ({
	llamaDb: {
		any: async () => [
			{
				protocol_slug: 'aave',
				parent_protocol_slug: null,
				category: 'Lending',
				tvl: 60,
				exclude_tvl_from_parent: false
			}
		]
	}
}))
const http = installFixtureFetch()
beforeEach(() => {
	http.serve({
		'/lite/protocols2': { protocols: [], parentProtocols: [], chains: [], protocolCategories: [] },
		'/v2/chart/tvl/protocol/aave/chain-breakdown': [
			[86_400, { Gnosis: 10, 'OP Mainnet': 20, 'ZKsync Era': 30, Ethereum: 1000 }]
		],
		'/lite/charts/Gnosis': { tvl: [[86_400, 10]] },
		'/lite/charts/OP%20Mainnet': { tvl: [[86_400, 20]] },
		'/lite/charts/ZKsync%20Era': { tvl: [[86_400, 30]] }
	})
})
describe('saved legacy chain aliases in TVL breakdown routes', () => {
	test('includes only the canonical chains in the protocol total', async () => {
		const result = await protocolTvlBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { chains: 'xdai,optimism,era', limit: '5' }
		})
		expect(result.status).toBe(200)
		expect('serializedJson' in result ? JSON.parse(result.serializedJson) : result.body).toMatchObject({
			series: [{ name: 'aave', data: [[86_400, 60]] }]
		})
	})
	test('includes canonical chains and excludes unrelated chains in the chain breakdown', async () => {
		const result = await protocolTvlByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { protocol: 'aave', chains: 'xdai,optimism,era', limit: '3' }
		})
		expect(result.status).toBe(200)
		expect('serializedJson' in result ? JSON.parse(result.serializedJson) : result.body).toMatchObject({
			series: [
				{ name: 'ZKsync Era', data: [[86_400, 30]] },
				{ name: 'OP Mainnet', data: [[86_400, 20]] },
				{ name: 'Gnosis', data: [[86_400, 10]] }
			]
		})
	})
})
