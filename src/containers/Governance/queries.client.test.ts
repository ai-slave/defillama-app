import { describe, expect, it } from 'vitest'
import { formatGovernanceData } from './queries.client'

describe('formatGovernanceData', () => {
	it('sorts object-keyed chart months once for both governance series', () => {
		const result = formatGovernanceData({
			proposals: [
				{
					id: 'one',
					title: 'One',
					state: 'closed',
					link: '',
					discussion: '',
					start: 0,
					end: 0,
					scores: [25, 75],
					choices: ['No', 'Yes'],
					scores_total: 100
				}
			],
			stats: {
				months: {
					'2024-03': { total: 3, successful: 2, proposals: ['one'] },
					'2024-01': { total: 1, successful: 1, proposals: [] },
					'2024-02': { total: 2, successful: 1, proposals: ['one'] }
				}
			}
		})

		expect(result.activity.map((row) => row.date)).toEqual([
			Date.UTC(2024, 0, 1) / 1000,
			Date.UTC(2024, 1, 1) / 1000,
			Date.UTC(2024, 2, 1) / 1000
		])
		expect(result.maxVotes.map((row) => row.date)).toEqual(result.activity.map((row) => row.date))
		expect(result.maxVotes.map((row) => row['Max Votes'])).toEqual(['0.00', '100.00', '100.00'])
	})
})
