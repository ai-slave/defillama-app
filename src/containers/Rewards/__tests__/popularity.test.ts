import { describe, expect, test, vi } from 'vitest'
import type { RewardsApiRecord, RewardsPopularity } from '../api.types'
import { buildRewardsPageData } from '../queries.server'
import { apiRecord } from './fixtures'

vi.mock('~/utils/telemetry', () => ({ recordDomainEvent: vi.fn() }))
const rankings: RewardsPopularity = { version: 1, startAt: 0, endAt: 1, viewsByPath: {} }

describe('Rewards popularity boundary', () => {
	test('rejects a catalog served by the old producer with omitted project paths', () => {
		const legacy: Partial<RewardsApiRecord> = apiRecord({})
		delete legacy.project_path
		const entries: Array<RewardsApiRecord> = JSON.parse(JSON.stringify([legacy]))
		expect(() => buildRewardsPageData(entries, {}, { version: 1, startAt: 0, endAt: 1, viewsByPath: {} })).toThrow(
			'Rewards catalog is missing project_path'
		)
	})

	test('shares parent popularity without changing child navigation or CEX suppression', () => {
		const { programs } = buildRewardsPageData(
			[
				apiRecord({ program_id: 'a', defillama_id: 'child', project_path: '/protocol/example' }),
				apiRecord({ program_id: 'b', defillama_id: 'child', project_path: '/protocol/example' }),
				apiRecord({ program_id: 'c', defillama_id: 'cex', project_path: null })
			],
			{ child: { name: 'Example Bridge' }, cex: { name: 'Exchange', cex: true } },
			{ version: 1, startAt: 0, endAt: 1, viewsByPath: { '/protocol/example': 500 } }
		)
		expect(programs.map(({ programId, protocolHref }) => [programId, protocolHref])).toEqual([
			['a', '/protocol/example-bridge'],
			['b', '/protocol/example-bridge'],
			['c', null]
		])
	})
	test('orders string-ranked featured programs before the popularity-ranked catalog without returning ranks or counts', () => {
		const { programs } = buildRewardsPageData(
			[
				apiRecord({
					program_id: 'featured-6',
					protocol: 'Featured 6',
					project_path: '/protocol/featured-6',
					featured_rank: '6'
				}),
				apiRecord({
					program_id: 'featured-5',
					protocol: 'Featured 5',
					project_path: '/protocol/featured-5',
					featured_rank: '5'
				}),
				apiRecord({ program_id: 'unresolved', protocol: 'A', project_path: null }),
				apiRecord({
					program_id: 'featured-2',
					protocol: 'Featured 2',
					project_path: '/protocol/featured-2',
					featured_rank: '2'
				}),
				apiRecord({ program_id: 'new', protocol: 'B', project_path: '/protocol/new' }),
				apiRecord({ program_id: 'zero', protocol: 'Z', project_path: '/protocol/zero' }),
				apiRecord({
					program_id: 'featured-1',
					protocol: 'Featured 1',
					project_path: '/protocol/featured-1',
					featured_rank: '1'
				}),
				apiRecord({ program_id: 'popular-z', protocol: 'Z', project_path: '/protocol/example' }),
				apiRecord({ program_id: 'popular-a', protocol: 'A', project_path: '/protocol/example' }),
				apiRecord({
					program_id: 'featured-4',
					protocol: 'Featured 4',
					project_path: '/protocol/featured-4',
					featured_rank: '4'
				}),
				apiRecord({
					program_id: 'featured-3',
					protocol: 'Featured 3',
					project_path: '/protocol/featured-3',
					featured_rank: '3'
				})
			],
			{},
			{ version: 1, startAt: 0, endAt: 1, viewsByPath: { '/protocol/example': 500, '/protocol/zero': 0 } }
		)
		expect(programs.map((p) => p.programId)).toEqual([
			'featured-1',
			'featured-2',
			'featured-3',
			'featured-4',
			'featured-5',
			'featured-6',
			'popular-a',
			'popular-z',
			'zero',
			'unresolved',
			'new'
		])
		expect(programs.every((p) => !('featuredRank' in p) && !('pageViews' in p))).toBe(true)
	})

	test('rejects invalid and duplicate featured ranks', () => {
		expect(() =>
			buildRewardsPageData([apiRecord({ program_id: 'invalid', featured_rank: '0' })], {}, rankings)
		).toThrow('Rewards program invalid has invalid featured_rank 0')
		expect(() =>
			buildRewardsPageData(
				[
					apiRecord({ program_id: 'first', featured_rank: '1' }),
					apiRecord({ program_id: 'second', featured_rank: '1' })
				],
				{},
				rankings
			)
		).toThrow('Rewards programs first and second share featured_rank 1')
	})
})
