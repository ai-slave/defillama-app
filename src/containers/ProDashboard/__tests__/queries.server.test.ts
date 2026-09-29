import { describe, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import {
	buildProDashboardProtocolCatalog,
	buildProDashboardProtocolRelations,
	type ProDashboardProtocolCatalog
} from '../protocolCatalog'
import { fetchSingleChartData } from '../queries.server'
import { fetchProProtocolCatalogSourceRows } from '../server/protocolCatalogSource'

const llamaQuery = vi.hoisted(() => vi.fn())
vi.mock('~/server/db/llama', () => ({ llamaDb: { query: llamaQuery } }))
const http = installFixtureFetch()
const metadata = installMetadataSeeder()
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

describe('fetchSingleChartData open interest', () => {
	const openInterestChart = (slug: string) =>
		`${V2_SERVER_URL}/chart/open-interest/protocol/${slug}?dataType=openInterestAtEnd`
	const lensRow = (slug: string) => ({
		slug,
		name: slug,
		protocol: 'derive',
		category: null,
		tvl_base: 0,
		symbol: null,
		token_nk: null,
		has_misrepresented_tokens: false,
		exclude_tvl_from_parent: false
	})

	test.each([
		[
			'openInterest',
			[
				[1, 85],
				[2, 90]
			]
		],
		[
			'optionsOpenInterest',
			[
				[1, 1600],
				[2, 1700]
			]
		]
	] as const)('reads a parent %s from the catalog children flagged for it', async (type, expected) => {
		metadata.seed({
			protocolRouteIdBySlug: { 'derive-v2': '3923', 'derive-v1': '100', 'derive-options': '5060' },
			protocolMetadata: {
				'3923': { displayName: 'Derive V2', openInterest: true },
				'100': { displayName: 'Derive V1', openInterest: true },
				'5060': { displayName: 'Derive Options', optionsOpenInterest: true }
			}
		})
		llamaQuery.mockResolvedValue([lensRow('derive-v2'), lensRow('derive-v1'), lensRow('derive-options')])
		const catalogFromLens = buildProDashboardProtocolCatalog(
			await fetchProProtocolCatalogSourceRows(),
			{ protocols: [], chains: [], parentProtocols: [], protocolCategories: [] },
			[]
		)
		http.serve({
			// The parent's own chart adds perp and options open interest together.
			[openInterestChart('derive')]: [[1, 1685]],
			[openInterestChart('derive-v2')]: [
				[1, 80],
				[2, 90]
			],
			[openInterestChart('derive-v1')]: [[1, 5]],
			[openInterestChart('derive-options')]: [
				[1, 1600],
				[2, 1700]
			]
		})

		await expect(
			fetchSingleChartData(
				{ type, subjectType: 'protocol', protocol: 'derive' },
				'all',
				null,
				buildProDashboardProtocolRelations(catalogFromLens)
			)
		).resolves.toEqual(expected)
	})
})
