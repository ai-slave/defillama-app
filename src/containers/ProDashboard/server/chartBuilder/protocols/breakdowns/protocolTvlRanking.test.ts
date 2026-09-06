import { beforeEach, describe, expect, test, vi } from 'vitest'
import { buildProtocolTvlRanking, fetchProtocolTvlRankingRows, type ProtocolTvlRankingRow } from './protocolTvlRanking'

const { anyMock } = vi.hoisted(() => ({ anyMock: vi.fn() }))

vi.mock('~/server/db/llama', () => ({ llamaDb: { any: anyMock } }))

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

function requireMockCall(index: number): Array<unknown> {
	const call = anyMock.mock.calls[index]
	if (!call) throw new Error(`Expected database call ${index}`)
	return call
}

describe('protocol TVL Lens ranking', () => {
	beforeEach(() => {
		anyMock.mockReset().mockResolvedValue([])
	})

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

	test('uses global current views for all-chain ranking', async () => {
		await fetchProtocolTvlRankingRows({ chains: ['All'], chainFilterMode: 'include' })
		const [query, params] = requireMockCall(0)

		expect(query).toContain('FROM lens.metrics_protocol_current mp')
		expect(query).not.toContain('metrics_protocol_by_chain_current')
		expect(params).toEqual([])
	})

	test('expresses selected-chain include and exclusion exactly in Lens SQL', async () => {
		await fetchProtocolTvlRankingRows({ chains: ['Arbitrum One'], chainFilterMode: 'include' })
		await fetchProtocolTvlRankingRows({ chains: ['Ethereum', 'Base'], chainFilterMode: 'exclude' })
		const [includeQuery, includeParams] = requireMockCall(0)
		const [excludeQuery, excludeParams] = requireMockCall(1)

		expect(includeQuery).toContain('lower(metrics.chain) = ANY($1)')
		expect(includeQuery).toContain('lens.metrics_sub_protocol_by_chain_current')
		expect(includeParams).toEqual([['arbitrum-one']])
		expect(excludeQuery).toContain('lower(metrics.chain) <> ALL($1)')
		expect(excludeQuery).toContain('lens.metrics_protocol_by_chain_current')
		expect(excludeParams).toEqual([['ethereum', 'base']])
	})
})
