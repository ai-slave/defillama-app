import { describe, expect, test, vi } from 'vitest'
import { buildProtocolTvlRanking, type ProtocolTvlRankingRow, resolveRankingFilter } from './protocolTvlRanking'

// The module opens a DB pool on import; these tests only use its pure helpers.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))

function row(overrides: Partial<ProtocolTvlRankingRow>): ProtocolTvlRankingRow {
	return {
		protocolSlug: 'protocol',
		parentProtocolSlug: null,
		category: 'Dexs',
		tvl: 1,
		excludeTvlFromParent: false,
		...overrides
	}
}

describe('protocol TVL Lens ranking', () => {
	test('ranks parent sums while keeping parent-excluded children standalone', () => {
		const result = buildProtocolTvlRanking({
			rows: [
				row({ protocolSlug: 'child-a', parentProtocolSlug: 'parent', tvl: 60 }),
				row({ protocolSlug: 'child-b', parentProtocolSlug: 'parent', tvl: 50 }),
				row({ protocolSlug: 'excluded-child', parentProtocolSlug: 'parent', tvl: 1000, excludeTvlFromParent: true }),
				row({ protocolSlug: 'standalone', tvl: 100 })
			],
			topN: 3,
			groupByParent: true,
			categories: [],
			categoryFilterMode: 'include'
		})

		expect(result.items).toEqual([
			{ protocolSlug: 'excluded-child', parentProtocolSlug: null, value: 1000, isParent: false },
			{ protocolSlug: 'parent', parentProtocolSlug: 'parent', value: 110, isParent: true },
			{ protocolSlug: 'standalone', parentProtocolSlug: null, value: 100, isParent: false }
		])
	})

	test('applies canonical Lens categories before ranking and preserves excluded children as standalone rows', () => {
		const rows = [
			row({ protocolSlug: 'dex', category: 'Dexs', tvl: 20, excludeTvlFromParent: true }),
			row({ protocolSlug: 'lending', category: 'Lending', tvl: 30 })
		]

		const result = buildProtocolTvlRanking({
			rows,
			topN: 5,
			groupByParent: false,
			categories: ['Dexs'],
			categoryFilterMode: 'include'
		})

		expect(result.items.map((item) => item.protocolSlug)).toEqual(['dex'])
	})

	test('an All selection ranks every chain, and selected chains filter by their Lens slug', () => {
		expect(resolveRankingFilter(['All'], 'include')).toEqual({ scope: 'global', chains: [] })
		expect(resolveRankingFilter([], 'exclude')).toEqual({ scope: 'global', chains: [] })
		expect(resolveRankingFilter(['All', 'Ethereum'], 'include')).toEqual({ scope: 'global', chains: [] })
		expect(resolveRankingFilter(['Arbitrum One'], 'include')).toEqual({ scope: 'include', chains: ['arbitrum-one'] })
		expect(resolveRankingFilter(['Ethereum', 'Base'], 'exclude')).toEqual({
			scope: 'exclude',
			chains: ['ethereum', 'base']
		})
	})
})
