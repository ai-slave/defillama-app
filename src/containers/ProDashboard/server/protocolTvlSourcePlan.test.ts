import { describe, expect, it } from 'vitest'
import type { ProDashboardProtocolCatalog } from '../protocolCatalog'
import { getProtocolTvlBreakdownQueryKey } from '../services/protocolTvl'
import type { DashboardItemConfig } from '../types'
import { buildProtocolTvlStreamSourcePlan } from './protocolTvlSourcePlan'

const catalog: ProDashboardProtocolCatalog = {
	protocols: [
		{ id: 'gearbox', name: 'Gearbox', slug: 'gearbox', tvl: 1, misrepresentedTokens: true },
		{ id: 'aave', name: 'Aave', slug: 'aave', tvl: 1 }
	],
	chains: []
}

describe('buildProtocolTvlStreamSourcePlan', () => {
	it('skips unsafe token sources while preserving both chain views', () => {
		const items: DashboardItemConfig[] = [
			{
				id: 'borrowed-token',
				kind: 'advanced-borrowed',
				protocol: 'gearbox',
				protocolName: 'Gearbox',
				chartType: 'tokenBorrowedRaw'
			},
			{
				id: 'borrowed-chain',
				kind: 'advanced-borrowed',
				protocol: 'gearbox',
				protocolName: 'Gearbox',
				chartType: 'chainsBorrowed'
			},
			{
				id: 'tvl-token',
				kind: 'advanced-tvl',
				protocol: 'gearbox',
				protocolName: 'Gearbox',
				chartType: 'tokenBalances'
			},
			{
				id: 'tvl-chain',
				kind: 'advanced-tvl',
				protocol: 'gearbox',
				protocolName: 'Gearbox',
				chartType: 'chainsTvl'
			}
		]

		const plan = buildProtocolTvlStreamSourcePlan(items, catalog)

		expect(plan.map((source) => source.request)).toEqual([
			{ protocol: 'gearbox', key: 'borrowed', breakdownType: 'chain-breakdown' },
			{ protocol: 'gearbox', key: undefined, breakdownType: 'chain-breakdown' }
		])
	})

	it('seeds the same deduplicated USD and raw keys consumed by raw borrowed charts', () => {
		const items: DashboardItemConfig[] = [
			{
				id: 'raw',
				kind: 'advanced-borrowed',
				protocol: 'aave',
				protocolName: 'Aave',
				chartType: 'tokenBorrowedRaw'
			},
			{
				id: 'usd',
				kind: 'advanced-borrowed',
				protocol: 'aave',
				protocolName: 'Aave',
				chartType: 'tokenBorrowedUsd'
			}
		]

		const plan = buildProtocolTvlStreamSourcePlan(items, catalog)

		expect(plan.map((source) => source.request)).toEqual([
			{ protocol: 'aave', key: 'borrowed', breakdownType: 'token-breakdown' },
			{
				protocol: 'aave',
				key: 'borrowed',
				breakdownType: 'token-breakdown',
				currency: 'token'
			}
		])
		for (const source of plan) {
			expect(source.queryKey).toEqual(getProtocolTvlBreakdownQueryKey(source.request))
		}
	})

	it('keeps sources enabled when catalog metadata is unavailable', () => {
		const items: DashboardItemConfig[] = [
			{
				id: 'raw',
				kind: 'advanced-borrowed',
				protocol: 'gearbox',
				protocolName: 'Gearbox',
				chartType: 'tokenBorrowedRaw'
			}
		]

		expect(buildProtocolTvlStreamSourcePlan(items, null)).toHaveLength(2)
	})
})
