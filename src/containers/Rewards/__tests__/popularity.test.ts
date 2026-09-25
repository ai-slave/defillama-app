import { describe, expect, test } from 'vitest'
import type { RewardsApiRecord, RewardsPopularity } from '../api.types'
import { buildRewardsPageData } from '../queries.server'
import { apiRecord } from './fixtures'
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

describe('Rewards card experiment data', () => {
	test('keeps both full table orders and selects at most three independent card ranks', () => {
		const entries = [
			apiRecord({
				program_id: 'featured',
				protocol: 'Featured',
				featured_rank: '1',
				featured_rank_card: '4',
				project_path: null
			}),
			apiRecord({ program_id: 'card2', protocol: 'Card2', featured_rank_card: '2', project_path: '/protocol/zero' }),
			apiRecord({
				program_id: 'popular',
				protocol: 'Popular',
				featured_rank_card: '3',
				project_path: '/protocol/popular'
			}),
			apiRecord({ program_id: 'card1', protocol: 'Card1', featured_rank_card: '1', project_path: null }),
			apiRecord({ program_id: 'hidden', visibility: 'Hidden', featured_rank_card: '1' }),
			apiRecord({ program_id: 'draft', publish_status: 'Draft', featured_rank_card: '1' })
		]
		const result = buildRewardsPageData(
			entries,
			{},
			{ ...rankings, viewsByPath: { '/protocol/popular': 10, '/protocol/zero': 0 } }
		)
		expect(result.programs.map((p) => p.programId)).toEqual(['featured', 'popular', 'card2', 'card1'])
		expect(result.popularityOrder).toEqual(['popular', 'card2', 'card1', 'featured'])
		expect(result.featuredCardIds).toEqual(['card1', 'card2', 'popular'])
	})

	test('allows zero or fewer than three cards without changing either table', () => {
		const entries = [apiRecord({ program_id: 'one' }), apiRecord({ program_id: 'two', featured_rank_card: '8' })]
		expect(buildRewardsPageData(entries, {}, rankings).featuredCardIds).toEqual(['two'])
		expect(buildRewardsPageData([entries[0]!], {}, rankings).featuredCardIds).toEqual([])
	})

	test.each(['0', '-1', '1.5', '', 'abc'])('rejects malformed editor card rank %j', (featured_rank_card) => {
		expect(() => buildRewardsPageData([apiRecord({ featured_rank_card })], {}, rankings)).toThrow(
			'invalid featured_rank_card'
		)
	})

	test('rejects duplicate card ranks independently of table ranks', () => {
		expect(() =>
			buildRewardsPageData(
				[
					apiRecord({ program_id: 'one', featured_rank_card: '1' }),
					apiRecord({ program_id: 'two', featured_rank_card: '1' })
				],
				{},
				rankings
			)
		).toThrow('share featured_rank_card 1')
		expect(
			buildRewardsPageData(
				[
					apiRecord({ program_id: 'one', featured_rank: '1' }),
					apiRecord({ program_id: 'two', featured_rank_card: '1' })
				],
				{},
				rankings
			).featuredCardIds
		).toEqual(['two'])
	})
})
