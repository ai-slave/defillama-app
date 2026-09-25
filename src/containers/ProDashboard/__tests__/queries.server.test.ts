import { describe, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { buildProDashboardProtocolRelations, type ProDashboardProtocolCatalog } from '../protocolCatalog'
import { fetchSingleChartData } from '../queries.server'

// The database client connects at import; these charts never read it.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))
const http = installFixtureFetch()
const feesChart = (slug: string) => `${V2_SERVER_URL}/chart/fees/protocol/${slug}`

const catalog: ProDashboardProtocolCatalog = {
	protocols: [
		{ id: 'parent#aave', name: 'Aave', slug: 'aave', tvl: 30, chains: [] },
		{
			id: '1',
			name: 'Aave V2',
			slug: 'aave-v2',
			symbol: 'AAVE',
			tvl: 10,
			chains: [],
			parentProtocol: 'parent#aave'
		},
		{
			id: '2',
			name: 'Aave V3',
			slug: 'aave-v3',
			symbol: 'AAVE',
			tvl: 20,
			chains: [],
			parentProtocol: 'parent#aave'
		}
	],
	chains: []
}
const protocolRelations = buildProDashboardProtocolRelations(catalog)

describe('fetchSingleChartData parent fallback', () => {
	test('sums child series when a parent has no direct adapter chart', async () => {
		http.serve({
			[feesChart('aave')]: [],
			[feesChart('aave-v2')]: [[1, 10]],
			[feesChart('aave-v3')]: [
				[1, 20],
				[2, 5]
			]
		})

		await expect(
			fetchSingleChartData({ type: 'fees', subjectType: 'protocol', protocol: 'aave' }, 'all', null, protocolRelations)
		).resolves.toEqual([
			[1, 30],
			[2, 5]
		])
	})

	test('rejects a partial child set instead of caching an understated parent total', async () => {
		http.serve({
			[feesChart('aave')]: [],
			[feesChart('aave-v2')]: [[1, 10]],
			[feesChart('aave-v3')]: fixtureStatus(404)
		})

		await expect(
			fetchSingleChartData({ type: 'fees', subjectType: 'protocol', protocol: 'aave' }, 'all', null, protocolRelations)
		).rejects.toThrow(/404/)
	})

	test('does not turn a standalone source failure into a successful empty result', async () => {
		http.serve({ [feesChart('standalone')]: fixtureStatus(404) })

		await expect(
			fetchSingleChartData(
				{ type: 'fees', subjectType: 'protocol', protocol: 'standalone' },
				'all',
				null,
				protocolRelations
			)
		).rejects.toThrow(/404/)
	})

	test('returns no data for unknown saved chart types without fetching a chart', async () => {
		await expect(
			fetchSingleChartData(
				{ type: 'legacy-unknown', subjectType: 'protocol', protocol: 'aave' },
				'all',
				null,
				protocolRelations
			)
		).resolves.toEqual([])

		expect(http.requests).toHaveLength(0)
	})
})
