import { describe, expect, test } from 'vitest'
import { buildProDashboardChartSourcePlan } from './chartSourcePlan'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { ProDashboardProtocolCatalog } from './protocolCatalog'

const catalog: ProDashboardProtocolCatalog = {
	protocols: [
		{
			id: '1',
			name: 'Aave V3',
			slug: 'aave-v3',
			symbol: 'AAVE',
			tvl: 1,
			chains: [],
			geckoId: 'aave',
			parentProtocol: 'parent#aave'
		},
		{ id: 'parent#aave', name: 'Aave', slug: 'aave', symbol: 'AAVE', tvl: 1, chains: [], geckoId: 'aave' }
	],
	chains: []
}

describe('Pro dashboard chart source planning', () => {
	test('deduplicates equivalent chart and metric cards and carries catalog metadata', () => {
		const items: Array<DashboardItemConfig> = [
			{ id: 'daily', kind: 'chart', subjectType: 'protocol', type: 'fees', protocol: 'aave', grouping: 'day' },
			{
				id: 'monthly',
				kind: 'chart',
				subjectType: 'protocol',
				type: 'fees',
				protocol: 'aave',
				grouping: 'month'
			},
			{
				id: 'metric',
				kind: 'metric',
				type: 'fees',
				subject: { itemType: 'protocol', protocol: 'aave' },
				window: 'all',
				aggregator: 'latest',
				chartType: 'sparkline'
			}
		]

		const plan = buildProDashboardChartSourcePlan(items, catalog)

		expect(plan).toHaveLength(1)
		expect(plan[0]?.request).toEqual({
			type: 'fees',
			subjectType: 'protocol',
			protocol: 'aave'
		})
	})

	test('keeps genuinely different raw data types separate', () => {
		const items: Array<DashboardItemConfig> = [
			{
				id: 'documented',
				kind: 'chart',
				subjectType: 'protocol',
				type: 'unlocks',
				protocol: 'aave',
				dataType: 'documented'
			},
			{
				id: 'realtime',
				kind: 'chart',
				subjectType: 'protocol',
				type: 'unlocks',
				protocol: 'aave',
				dataType: 'realtime'
			}
		]

		expect(buildProDashboardChartSourcePlan(items, catalog)).toHaveLength(2)
	})

	test('leaves metadata-dependent sources unseeded when the catalog is unavailable', () => {
		const items: Array<DashboardItemConfig> = [
			{ id: 'mcap', kind: 'chart', subjectType: 'protocol', type: 'tokenMcap', protocol: 'aave' }
		]

		expect(buildProDashboardChartSourcePlan(items, null)).toEqual([])
	})

	test('seeds protocols outside canonical Pro membership as empty', () => {
		const items: Array<DashboardItemConfig> = [
			{ id: 'missing', kind: 'chart', subjectType: 'protocol', type: 'fees', protocol: 'free-protocol' }
		]

		expect(buildProDashboardChartSourcePlan(items, catalog)[0]?.skipReason).toBeDefined()
	})

	test('seeds unsupported persisted chain sources as empty instead of retrying a known-invalid API', () => {
		const items: Array<DashboardItemConfig> = [
			{ id: 'options', kind: 'chart', subjectType: 'chain', type: 'optionsPremium', chain: 'Solana' },
			{ id: 'active', kind: 'chart', subjectType: 'chain', type: 'activeUsers', chain: 'Solana' },
			{ id: 'new', kind: 'chart', subjectType: 'chain', type: 'newUsers', chain: 'Solana' },
			{ id: 'supply', kind: 'chart', subjectType: 'chain', type: 'stablecoins', chain: 'Solana' },
			{ id: 'inflows', kind: 'chart', subjectType: 'chain', type: 'stablecoinInflows', chain: 'Solana' }
		]
		const appMetadata = {
			protocols: {},
			pfPs: { pf: [], ps: [] },
			chains: {
				solana: {
					id: 'solana',
					name: 'Solana',
					optionsPremiumVolume: false,
					chainActiveUsers: true,
					chainNewUsers: false,
					stablecoins: false,
					inflows: true
				}
			}
		}

		const plan = buildProDashboardChartSourcePlan(items, catalog, appMetadata)

		expect(plan.map((source) => Boolean(source.skipReason))).toEqual([true, false, true, true, false])
	})

	test('attaches exact producer IDs to Bridged TVL sources for display names and legacy aliases', () => {
		const names = ['Hyperliquid', 'OP Mainnet', 'Avalanche', 'Gnosis', 'ZKsync Era']
		const items: Array<DashboardItemConfig> = names.map((chain, index) => ({
			id: `bridged-${index}`,
			kind: 'chart',
			subjectType: 'chain',
			type: 'bridgedTvl',
			chain
		}))
		const appMetadata = {
			protocols: {},
			pfPs: { pf: [], ps: [] },
			chains: {
				'hyperliquid-l1': { id: 'hyperliquid', name: 'Hyperliquid L1', chainAssets: true },
				'op-mainnet': { id: 'optimism', name: 'OP Mainnet', chainAssets: true },
				avalanche: { id: 'avax', name: 'Avalanche', chainAssets: true },
				gnosis: { id: 'xdai', name: 'Gnosis', chainAssets: true },
				'zksync-era': { id: 'era', name: 'ZKsync Era', chainAssets: true }
			}
		}

		const plan = buildProDashboardChartSourcePlan(items, catalog, appMetadata)

		expect(plan.map(({ request }) => request.chainAssetId)).toEqual(['hyperliquid', 'optimism', 'avax', 'xdai', 'era'])
	})

	test('seeds unsupported persisted protocol sources as empty instead of calling a missing adapter', () => {
		const items: Array<DashboardItemConfig> = [
			{ id: 'tvl', kind: 'chart', subjectType: 'protocol', type: 'tvl', protocol: 'huma-finance-v2' },
			{ id: 'fees', kind: 'chart', subjectType: 'protocol', type: 'fees', protocol: 'huma-finance-v2' },
			{ id: 'revenue', kind: 'chart', subjectType: 'protocol', type: 'revenue', protocol: 'huma-finance-v2' }
		]
		const appMetadata = {
			protocols: {
				'7930': {
					name: 'huma-finance-v2',
					displayName: 'Huma Finance V2',
					tvl: true
				}
			},
			pfPs: { pf: [], ps: [] },
			chains: {}
		}
		const catalogWithHuma: ProDashboardProtocolCatalog = {
			...catalog,
			protocols: [
				...catalog.protocols,
				{
					id: '7930',
					name: 'Huma Finance V2',
					slug: 'huma-finance-v2',
					symbol: 'HUMA',
					tvl: 1,
					chains: [],
					geckoId: null
				}
			]
		}

		const plan = buildProDashboardChartSourcePlan(items, catalogWithHuma, appMetadata)

		expect(plan.map((source) => Boolean(source.skipReason))).toEqual([false, true, true])
	})

	test('keeps a parent source fetchable when child metadata advertises the capability', () => {
		const items: Array<DashboardItemConfig> = [
			{ id: 'fees', kind: 'chart', subjectType: 'protocol', type: 'fees', protocol: 'aave' }
		]
		const appMetadata = {
			protocols: {
				parent: { name: 'aave', displayName: 'Aave' },
				child: { name: 'aave-v3', displayName: 'Aave V3', fees: true }
			},
			pfPs: { pf: [], ps: [] },
			chains: {}
		}

		const plan = buildProDashboardChartSourcePlan(items, catalog, appMetadata)

		expect(plan[0]?.skipReason).toBeUndefined()
	})
})
