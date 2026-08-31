import { describe, expect, it } from 'vitest'
import { readRewardsQuery, serializeRewardsQuery } from '../query'

describe('rewards URL state', () => {
	it('omits defaults and restores shared filters', () => {
		expect(serializeRewardsQuery(readRewardsQuery({}))).toEqual({
			status: undefined,
			reward: undefined,
			hideUnverified: undefined
		})
		const shared = {
			status: 'Ended',
			reward: ['Points', 'Commission'],
			hideUnverified: 'true'
		}
		const selection = readRewardsQuery(shared)
		expect(selection).toEqual({
			lifecycle: 'Ended',
			rewardTypes: ['Points', 'Commission'],
			hideUnverified: true
		})
		expect(serializeRewardsQuery(selection)).toEqual(shared)
	})
	it('ignores invalid URL values, deduplicates rewards, and preserves valid zero-count choices', () => {
		expect(
			readRewardsQuery({
				status: 'invalid',
				reward: ['Points', 'Points', 'invalid'],
				hideUnverified: 'false'
			})
		).toEqual({
			lifecycle: 'All',
			rewardTypes: ['Points'],
			hideUnverified: false
		})
		expect(readRewardsQuery({ status: 'Upcoming', reward: 'Commission' }).lifecycle).toBe('Upcoming')
		expect(readRewardsQuery({ sort: 'pageViews', order: 'asc' })).toEqual(readRewardsQuery({}))
	})
})
