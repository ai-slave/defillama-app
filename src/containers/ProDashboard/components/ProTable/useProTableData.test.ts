import { describe, expect, it } from 'vitest'
import { resolveProtocolTableSourcePlan } from '../../protocolTableSourcePlan'
import type { IProtocolRow } from './proTable.types'
import {
	createProTableSearchIndex,
	filterProTableProtocols,
	matchesProTableSearch,
	normalizeProTableSearchQuery,
	prepareProTableRows
} from './proTablePreparation'

const child = (name: string, category: string, oracle: string, tvl: number, volume: number): IProtocolRow =>
	({
		name,
		category,
		oracles: [oracle],
		oraclesByChain: { Ethereum: [oracle] },
		tvl,
		tvlPrevDay: tvl / 2,
		tvlPrevWeek: tvl / 4,
		tvlPrevMonth: tvl / 5,
		mcap: tvl * 2,
		volume_7d: volume,
		volumeChange_7d: volume / 10,
		chainTvls: {},
		chains: ['Ethereum'],
		logo: null,
		url: '',
		defillamaId: name,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		mcaptvl: null
	}) satisfies IProtocolRow

describe('filterProTableProtocols behavior fixture', () => {
	it('preserves combined parent/child filter semantics and recalculates surviving parent values', () => {
		const lending = child('Lending Child', 'Lending', 'Chainlink', 100, 20)
		const dex = child('DEX Child', 'Dexs', 'Pyth', 50, 10)
		const excluded = child('Excluded Child', 'CEX', 'Chainlink', 500, 100)
		const parent = {
			...child('Parent', 'Parent Protocol', 'Parent Oracle', 650, 130),
			isParentProtocol: true,
			subRows: [lending, dex, excluded]
		} as IProtocolRow

		const result = filterProTableProtocols([parent], {
			protocols: ['Lending Child', 'DEX Child'],
			categories: ['Lending'],
			excludedCategories: ['CEX'],
			oracles: ['Chainlink']
		})

		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			name: 'Parent',
			tvl: 100,
			mcap: 200,
			volume_7d: 20,
			volumeChange_7d: 2,
			oracles: ['Chainlink', 'Parent Oracle', 'Pyth'],
			oraclesByChain: { Ethereum: ['Chainlink', 'Parent Oracle', 'Pyth'] }
		})
		expect(result[0].subRows?.map((row) => row.name)).toEqual(['Lending Child'])
	})

	it('preserves parent and child order while retaining unchanged row identities', () => {
		const firstChild = child('First Child', 'Lending', 'Chainlink', 100, 20)
		const secondChild = child('Second Child', 'Lending', 'Chainlink', 50, 10)
		const firstParent = {
			...child('First Parent', 'Lending', 'Chainlink', 150, 30),
			isParentProtocol: true,
			subRows: [firstChild, secondChild]
		} as IProtocolRow
		const standalone = child('Standalone', 'Lending', 'Chainlink', 25, 5)

		const result = filterProTableProtocols([firstParent, standalone], { categories: ['Lending'] })

		expect(result).toEqual([firstParent, standalone])
		expect(result[0]).toBe(firstParent)
		expect(result[0].subRows).toEqual([firstChild, secondChild])
		expect(result[1]).toBe(standalone)
	})

	it('preserves weighted changes and incomplete annualized parent semantics', () => {
		const first = {
			...child('First', 'Lending', 'Chainlink', 100, 100),
			fees_24h: 10,
			feesAnnualized1y: 100,
			revenue_24h: 5,
			revenueAnnualized1y: 50,
			perps_volume_7d: 40,
			perps_volume_change_7d: 5
		}
		const second = {
			...child('Second', 'Lending', 'Chainlink', 200, 300),
			fees_24h: 20,
			feesAnnualized1y: null,
			revenue_24h: 10,
			revenueAnnualized1y: 100,
			perps_volume_7d: 60,
			perps_volume_change_7d: 15
		}
		const parent = {
			...child('Parent', 'Parent Protocol', 'Parent Oracle', 300, 400),
			isParentProtocol: true,
			subRows: [first, second]
		} as IProtocolRow

		const [result] = filterProTableProtocols([parent], { categories: ['Lending'] })

		expect(result).toMatchObject({
			tvl: 300,
			mcap: 600,
			volume_7d: 400,
			volumeChange_7d: 25,
			perps_volume_7d: 100,
			perps_volume_change_7d: 11,
			feesAnnualized1y: null,
			revenueAnnualized1y: 150,
			pf: null,
			ps: 4
		})
	})

	it('merges only enabled sources and accepts partial metric arrival', () => {
		const base = child('Alpha', 'Lending', 'Chainlink', 100, 20)
		const volumeData = [{ name: 'Alpha', total24h: 12 }]
		const feesData = [{ name: 'Alpha', total24h: 99 }]
		const volumePlan = resolveProtocolTableSourcePlan({ columnOrder: ['name', 'volume_24h'] })

		const beforeVolume = prepareProTableRows({
			protocols: [base],
			parentProtocols: [],
			sourcePlan: volumePlan,
			volumeData: undefined,
			feesData
		})
		const afterVolume = prepareProTableRows({
			protocols: [base],
			parentProtocols: [],
			sourcePlan: volumePlan,
			volumeData,
			feesData
		})

		expect(beforeVolume[0].volume_24h).toBeUndefined()
		expect(beforeVolume[0].fees_24h).toBeUndefined()
		expect(afterVolume[0].volume_24h).toBe(12)
		expect(afterVolume[0].fees_24h).toBeUndefined()
	})

	it('builds one ephemeral normalized search entry per prepared row', () => {
		const nested = child('Nested Pool', 'Dexs', 'Pyth', 50, 10)
		const parent = {
			...child('Parent Protocol', 'Lending', 'Chainlink', 50, 10),
			symbol: 'PRT',
			chains: ['Arbitrum One', 'Base'],
			subRows: [nested]
		} as IProtocolRow
		const index = createProTableSearchIndex([parent])

		expect(matchesProTableSearch(parent, normalizeProTableSearchQuery('  ARBITRUM  '), index)).toBe(true)
		expect(matchesProTableSearch(parent, 'one base', index)).toBe(true)
		expect(matchesProTableSearch(parent, 'chainlink', index)).toBe(true)
		expect(matchesProTableSearch(parent, 'protocol lending', index)).toBe(false)
		expect(matchesProTableSearch(nested, 'nested pool', index)).toBe(true)
		expect(matchesProTableSearch(nested, 'lending', index)).toBe(false)
		expect(parent).not.toHaveProperty('searchText')
	})
})
