import { describe, expect, test } from 'vitest'
import { getRewardsView } from '../utils'
import { filters, program } from './fixtures'

const programs = [
	program({ programId: 'referral', rewardTypes: ['Commission', 'Fee Discount'] }),
	program({ programId: 'contest', programName: 'Trading contest', lifecycle: 'Ended', rewardTypes: ['Prize Pool'] }),
	program({
		programId: 'points',
		defillamaId: '2',
		protocol: 'Second',
		rewardTypes: ['Points'],
		verification: 'Unverified'
	}),
	program({ programId: 'unknown', defillamaId: '3', protocol: 'Third', lifecycle: 'Unknown', rewardTypes: [] })
]

describe('rewards filtering and counts', () => {
	test('defaults to live programs without merging multiple programs from a protocol', () => {
		const view = getRewardsView(programs, filters({}))
		expect(view.rows.map((row) => row.programId)).toEqual(['referral', 'points'])
		expect(view.lifecycleCounts).toEqual({ All: 4, Live: 2, Upcoming: 0, 'Season Gap': 0, Ended: 1, Unknown: 1 })
	})
	test('matches reward selections with OR and combines groups with AND', () => {
		const view = getRewardsView(programs, filters({ rewardTypes: ['Commission', 'Points'], hideUnverified: true }))
		expect(view.rows.map((row) => row.programId)).toEqual(['referral'])
		expect(view.rewardCounts['Fee Discount']).toBe(1)
		expect(view.rewardCounts.Points).toBe(0)
	})
	test('counts unverified matches for the toggle label and drops them once hidden', () => {
		expect(getRewardsView(programs, filters({})).unverified).toBe(1)
		const hidden = getRewardsView(programs, filters({ hideUnverified: true }))
		expect(hidden.rows.map((row) => row.programId)).toEqual(['referral'])
		// The label keeps reporting what the toggle is suppressing, so it stays reversible.
		expect(hidden.unverified).toBe(1)
		expect(getRewardsView(programs, filters({ lifecycle: 'Ended' })).unverified).toBe(0)
	})
	test('offers only the lifecycles and reward types the dataset contains, regardless of filters', () => {
		const view = getRewardsView(programs, filters({ search: 'nothing matches', lifecycle: 'Ended' }))
		expect([...view.availableLifecycles].sort()).toEqual(['Ended', 'Live', 'Unknown'])
		expect([...view.availableRewardTypes].sort()).toEqual(['Commission', 'Fee Discount', 'Points', 'Prize Pool'])
	})
	test('searches protocol and program names case-insensitively with each facet ignoring its own selection', () => {
		const view = getRewardsView(programs, filters({ search: '  CONTEST  ' }))
		expect(view.rows).toEqual([])
		expect(view.lifecycleCounts.Ended).toBe(1)
		expect(
			getRewardsView(programs, filters({ search: 'contest', lifecycle: 'All' })).rows.map((row) => row.programId)
		).toEqual(['contest'])
	})
	test('preserves unspecified reward types and Unknown lifecycle without treating them as live', () => {
		const view = getRewardsView(programs, filters({ lifecycle: 'Unknown' }))
		expect(view.rows.map((row) => row.programId)).toEqual(['unknown'])
		expect(getRewardsView(programs, filters({ lifecycle: 'Unknown', rewardTypes: ['Points'] })).rows).toEqual([])
	})
})
