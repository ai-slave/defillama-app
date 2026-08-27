import { describe, expect, it } from 'vitest'
import { readRewardsQuery, serializeRewardsQuery } from '../query'

describe('rewards URL state', () => {
	it('omits defaults and restores a shared multi-filter and ranking selection', () => {
		expect(serializeRewardsQuery(readRewardsQuery({}))).toEqual({
			status: undefined,
			reward: undefined,
			hideUnverified: undefined,
			sort: undefined,
			order: undefined
		})
		const shared = {
			status: 'Ended',
			reward: ['Points', 'Commission'],
			hideUnverified: 'true',
			sort: 'tvl',
			order: 'asc'
		}
		const selection = readRewardsQuery(shared)
		expect(selection).toEqual({
			lifecycle: 'Ended',
			rewardTypes: ['Points', 'Commission'],
			hideUnverified: true,
			sort: 'tvl',
			desc: false
		})
		expect(serializeRewardsQuery(selection)).toEqual(shared)
	})
	it('ignores invalid URL values, deduplicates rewards, and preserves valid zero-count choices', () => {
		expect(
			readRewardsQuery({
				status: 'invalid',
				reward: ['Points', 'Points', 'invalid'],
				sort: 'invalid',
				order: 'invalid',
				hideUnverified: 'false'
			})
		).toEqual({
			lifecycle: 'All',
			rewardTypes: ['Points'],
			hideUnverified: false,
			sort: 'fees30d',
			desc: true
		})
		expect(readRewardsQuery({ status: 'Upcoming', reward: 'Commission' }).lifecycle).toBe('Upcoming')
	})
})
