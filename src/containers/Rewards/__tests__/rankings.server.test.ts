import { describe, expect, it } from 'vitest'
import { buildRewardsPageData } from '../queries.server'
import { buildRewardsRankings } from '../rankings.server'
import { apiRecord } from './fixtures'

describe('rewards project ranking', () => {
	it('assigns parent metrics to each program without changing identity or double-counting parent fees', () => {
		const rankings = buildRewardsRankings(
			[
				{
					defillamaId: 'bridge',
					parentProtocol: 'parent#example',
					tvl: 100,
					chainTvls: { excludeParent: { tvl: 20, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null } }
				},
				{ defillamaId: 'perps', parentProtocol: 'parent#example', tvl: 50, chainTvls: {} },
				{ defillamaId: 'metadata-only', parentProtocol: 'parent#example', tvl: null, chainTvls: {} },
				{ defillamaId: 'small', tvl: 20, chainTvls: {} }
			],
			[
				{ defillamaId: 'perps', total30d: 60 },
				{ defillamaId: 'parent#example', total30d: 75 },
				{ defillamaId: 'small', total30d: 5 }
			]
		)
		const { programs } = buildRewardsPageData(
			[
				apiRecord({ program_id: 'small', defillama_id: 'small', protocol: 'A small project' }),
				apiRecord({ program_id: 'bridge', defillama_id: 'bridge', protocol: 'Example Bridge' }),
				apiRecord({ program_id: 'parent', defillama_id: 'parent#example', protocol: 'Example' })
			],
			{},
			rankings
		)
		expect(programs.map((p) => [p.programId, p.fees30d, p.tvl])).toEqual([
			['small', 5, 20],
			['parent', 75, 130],
			['bridge', 75, 130]
		])
		expect(programs[2]?.protocol).toBe('Example Bridge')
	})
	it('preserves zero and missing data, sums measured fee siblings, and does not invent unknown TVL overlap', () => {
		const rankings = buildRewardsRankings(
			[
				{
					defillamaId: 'one',
					parentProtocol: 'parent#example',
					tvl: 100,
					chainTvls: { excludeParent: { tvl: null, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null } }
				},
				{ defillamaId: 'two', parentProtocol: 'parent#example', tvl: 10, chainTvls: {} },
				{ defillamaId: 'zero', tvl: 0, chainTvls: {} }
			],
			[
				{ defillamaId: 'one', total30d: 12 },
				{ defillamaId: 'two', total30d: null },
				{ defillamaId: 'zero', total30d: 0 },
				{ defillamaId: 'missing', parentProtocol: 'parent#missing' }
			]
		)
		expect(rankings.feesById.get('parent#example')).toBe(12)
		expect(rankings.tvlById.get('parent#example')).toBeNull()
		expect(rankings.feesById.get('zero')).toBe(0)
		expect(rankings.tvlById.get('zero')).toBe(0)
		expect(rankings.feesById.get('parent#missing')).toBeUndefined()
		const { programs } = buildRewardsPageData(
			[
				apiRecord({ program_id: 'missing', defillama_id: 'missing' }),
				apiRecord({ program_id: 'zero', defillama_id: 'zero' })
			],
			{},
			rankings
		)
		expect(programs.map((p) => [p.programId, p.fees30d])).toEqual([
			['missing', null],
			['zero', 0]
		])
	})
})
