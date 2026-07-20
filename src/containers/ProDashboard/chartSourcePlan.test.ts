import { describe, expect, it } from 'vitest'
import { buildProDashboardChartSourcePlan } from './chartSourcePlan'
import type { ProDashboardProtocolCatalog } from './protocolCatalog'
import type { DashboardItemConfig } from './types'

const catalog: ProDashboardProtocolCatalog = {
	protocols: [
		{
			id: '1',
			name: 'Aave V3',
			slug: 'aave-v3',
			symbol: 'AAVE',
			tvl: 1,
			geckoId: 'aave',
			parentProtocol: 'parent#aave'
		},
		{ id: 'parent#aave', name: 'Aave', slug: 'aave', symbol: 'AAVE', tvl: 1, geckoId: 'aave' }
	],
	chains: []
}

describe('Pro dashboard chart source planning', () => {
	it('deduplicates equivalent chart and metric cards and carries catalog metadata', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'daily', kind: 'chart', type: 'liquidity', protocol: 'aave', chain: '', grouping: 'day' },
			{ id: 'monthly', kind: 'chart', type: 'liquidity', protocol: 'aave', chain: '', grouping: 'month' },
			{
				id: 'metric',
				kind: 'metric',
				type: 'liquidity',
				subject: { itemType: 'protocol', protocol: 'aave' },
				window: 'all',
				aggregator: 'latest'
			}
		]

		const plan = buildProDashboardChartSourcePlan(items, catalog)

		expect(plan).toHaveLength(1)
		expect(plan[0].request).toEqual({
			type: 'liquidity',
			protocol: 'aave',
			chain: '',
			geckoId: undefined,
			dataType: undefined,
			protocolSymbol: 'AAVE'
		})
	})

	it('keeps genuinely different raw data types separate', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'documented', kind: 'chart', type: 'unlocks', protocol: 'aave', chain: '', dataType: 'documented' },
			{ id: 'realtime', kind: 'chart', type: 'unlocks', protocol: 'aave', chain: '', dataType: 'realtime' }
		]

		expect(buildProDashboardChartSourcePlan(items, catalog)).toHaveLength(2)
	})

	it('leaves metadata-dependent sources unseeded when the catalog is unavailable', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'liquidity', kind: 'chart', type: 'liquidity', protocol: 'aave', chain: '' }
		]

		expect(buildProDashboardChartSourcePlan(items, null)).toEqual([])
	})

	it('includes synthetic parent liquidity when the catalog carries its token symbol', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'parent-liquidity', kind: 'chart', type: 'liquidity', protocol: 'aave', chain: '' }
		]

		expect(buildProDashboardChartSourcePlan(items, catalog)).toEqual([
			expect.objectContaining({
				request: expect.objectContaining({ protocol: 'aave', protocolSymbol: 'AAVE' })
			})
		])
	})

	it('seeds unsupported persisted chain sources as empty instead of retrying a known-invalid API', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'options', kind: 'chart', type: 'options', protocol: '', chain: 'Solana' },
			{ id: 'active', kind: 'chart', type: 'activeUsers', protocol: '', chain: 'Solana' },
			{ id: 'new', kind: 'chart', type: 'newUsers', protocol: '', chain: 'Solana' }
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
					chainNewUsers: false
				}
			}
		}

		const plan = buildProDashboardChartSourcePlan(items, catalog, appMetadata)

		expect(plan.map((source) => source.skipReason)).toEqual([
			'chain does not support options premium volume',
			undefined,
			'chain does not expose a new-address pseudo-protocol'
		])
	})

	it('seeds unsupported persisted protocol sources as empty instead of calling a missing adapter', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'tvl', kind: 'chart', type: 'tvl', protocol: 'huma-finance-v2', chain: '' },
			{ id: 'fees', kind: 'chart', type: 'fees', protocol: 'huma-finance-v2', chain: '' },
			{ id: 'revenue', kind: 'chart', type: 'revenue', protocol: 'huma-finance-v2', chain: '' }
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

		const plan = buildProDashboardChartSourcePlan(items, catalog, appMetadata)

		expect(plan.map((source) => source.skipReason)).toEqual([
			undefined,
			'protocol does not support fees',
			'protocol does not support revenue'
		])
	})

	it('keeps a parent source fetchable when child metadata advertises the capability', () => {
		const items: DashboardItemConfig[] = [{ id: 'fees', kind: 'chart', type: 'fees', protocol: 'aave', chain: '' }]
		const appMetadata = {
			protocols: {
				parent: { name: 'aave', displayName: 'Aave' },
				child: { name: 'aave-v3', displayName: 'Aave V3', fees: true }
			},
			pfPs: { pf: [], ps: [] },
			chains: {}
		}

		const plan = buildProDashboardChartSourcePlan(items, catalog, appMetadata)

		expect(plan[0].skipReason).toBeUndefined()
	})

	it('keeps symbol-backed parent liquidity fetchable without a metadata flag', () => {
		const items: DashboardItemConfig[] = [
			{ id: 'liquidity', kind: 'chart', type: 'liquidity', protocol: 'aave', chain: '' }
		]
		const parentOnlyCatalog: ProDashboardProtocolCatalog = {
			protocols: [catalog.protocols[1]],
			chains: []
		}
		const appMetadata = {
			protocols: {
				parent: { name: 'aave', displayName: 'Aave' }
			},
			pfPs: { pf: [], ps: [] },
			chains: {}
		}

		const plan = buildProDashboardChartSourcePlan(items, parentOnlyCatalog, appMetadata)

		expect(plan[0].skipReason).toBeUndefined()
	})
})
