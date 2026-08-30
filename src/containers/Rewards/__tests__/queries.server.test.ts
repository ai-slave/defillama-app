import { describe, expect, it, vi } from 'vitest'
import { buildRewardsPageData } from '../queries.server'
import { buildRewardsRankings } from '../rankings.server'
import { apiRecord } from './fixtures'

vi.mock('~/utils/telemetry', () => ({ recordDomainEvent: vi.fn() }))
const rankings = buildRewardsRankings([], [])

describe('rewards public page boundary', () => {
	it('requires both publication and explicit public visibility, independent of lifecycle or verification', () => {
		const missingVisibility = apiRecord({ program_id: 'missing' })
		delete missingVisibility.visibility
		const { programs } = buildRewardsPageData(
			[
				apiRecord({ program_id: 'live' }),
				apiRecord({ program_id: 'ended', lifecycle: 'Ended' }),
				apiRecord({ program_id: 'unknown', lifecycle: 'Unknown', verification: 'Unverified' }),
				apiRecord({ program_id: 'draft', publish_status: 'Draft' }),
				apiRecord({ program_id: 'hidden', visibility: 'Hidden' }),
				missingVisibility
			],
			{},
			rankings
		)
		expect(programs.map((r) => r.programId).sort()).toEqual(['ended', 'live', 'unknown'])
		expect(programs.every((r) => !('publish_status' in r) && !('visibility' in r))).toBe(true)
	})

	it('preserves separate programs, metadata identity, and sources named by publisher', () => {
		const { programs } = buildRewardsPageData(
			[
				apiRecord({
					program_id: 'contest',
					program_name: 'Trading contest',
					lifecycle: 'Ended',
					start_date: '2026-05-18',
					end_date: '2026-12-01',
					source_url:
						' https://example.com/terms | https://www.docs.example.com/announcement | https://example.com/terms '
				}),
				apiRecord({ program_id: 'referral' })
			],
			{ '1': { name: 'example-protocol', displayName: 'Example Protocol', category: 'Derivatives' } },
			rankings
		)
		expect(programs).toHaveLength(2)
		expect(programs[0]).toMatchObject({
			programId: 'referral',
			protocol: 'Example Protocol',
			protocolHref: '/protocol/example-protocol',
			category: 'Derivatives'
		})
		expect(programs[1]).toMatchObject({
			programId: 'contest',
			lifecycle: 'Ended',
			sources: [
				{ url: 'https://example.com/terms', label: 'example.com' },
				{ url: 'https://www.docs.example.com/announcement', label: 'docs.example.com' }
			]
		})
	})

	it.each(['Live', 'Ended'] as const)('retains %s programs when the API omits the source URL', (lifecycle) => {
		const entry = apiRecord({ lifecycle })
		delete entry.source_url
		const { programs } = buildRewardsPageData([entry], {}, rankings)
		expect(programs).toHaveLength(1)
		expect(programs[0]).toMatchObject({
			programId: entry.program_id,
			lifecycle,
			referralUrl: entry.referral_url,
			sources: []
		})
	})

	it('retains programs when the API omits the referral URL', () => {
		const entry = apiRecord({})
		delete entry.referral_url
		expect(buildRewardsPageData([entry], {}, rankings).programs[0]).toMatchObject({
			programId: entry.program_id,
			referralUrl: null,
			sources: [{ url: entry.source_url, label: 'example.com' }]
		})
	})

	it('labels dates at the month granularity editors record, and sorts by the earliest known date', () => {
		const [both, startOnly, endOnly, neither] = buildRewardsPageData(
			[
				apiRecord({ program_id: 'a-both', start_date: '2025-10-01', end_date: '2026-10-01' }),
				apiRecord({ program_id: 'b-start', start_date: '2025-10-01' }),
				apiRecord({ program_id: 'c-end', end_date: '2026-10-01' }),
				apiRecord({ program_id: 'd-none' })
			],
			{},
			rankings
		).programs
		expect(both).toMatchObject({ dateRangeLabel: 'Oct 2025 – Oct 2026', sortDate: '2025-10-01' })
		expect(startOnly).toMatchObject({ dateRangeLabel: 'From Oct 2025', sortDate: '2025-10-01' })
		// End-only rows still carry a sort key, so they cannot be forced last.
		expect(endOnly).toMatchObject({ dateRangeLabel: 'Until Oct 2026', sortDate: '2026-10-01' })
		expect(neither).toMatchObject({ dateRangeLabel: null, sortDate: null })
	})

	it('retains missing metadata and missing reward/date cells without inventing values', () => {
		const entry = apiRecord({})
		delete entry.reward_types
		expect(buildRewardsPageData([entry], {}, rankings).programs[0]).toMatchObject({
			protocol: 'Example',
			protocolHref: null,
			logo: null,
			category: null,
			rewardTypes: [],
			sortDate: null,
			dateRangeLabel: null,
			programName: null
		})
	})

	it('publishes referral earnings for every program, whatever reward types it lists', () => {
		const { programs } = buildRewardsPageData(
			[
				apiRecord({ program_id: 'points', referrer_benefit: 'Referrers earn 20% of referred points.' }),
				apiRecord({
					program_id: 'commission',
					reward_types: ['Commission', 'Fee Discount'],
					referrer_benefit: 'Earn 10% of referral fees.'
				}),
				apiRecord({ program_id: 'none', referrer_benefit: 'No current referrer reward is published.' })
			],
			{},
			rankings
		)
		expect(programs.map((r) => r.referrerBenefit)).toEqual([
			'Earn 10% of referral fees.',
			'No current referrer reward is published.',
			'Referrers earn 20% of referred points.'
		])
	})

	it('does not expose executable or hostless editor-entered links', () => {
		const { programs } = buildRewardsPageData(
			[
				apiRecord({
					referral_url: 'javascript:alert(1)',
					source_url: 'data:text/html,test | https:// | https://example.com/safe'
				})
			],
			{},
			rankings
		)
		expect(programs[0]).toMatchObject({
			referralUrl: null,
			sources: [{ url: 'https://example.com/safe', label: 'example.com' }]
		})
	})
})
