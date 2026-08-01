import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

import { getGovernanceDetailsPageData, getGovernancePageData } from './queries'

beforeEach(() => {
	vi.clearAllMocks()
})

describe('getGovernancePageData', () => {
	it('merges exact numeric overview caches and preserves omitted month proposal lists', async () => {
		mocks.fetchJson
			.mockResolvedValueOnce({
				first: {
					name: 'Project',
					proposalsCount: 2,
					followersCount: 10,
					strategyCount: 1,
					successfulProposals: 1,
					states: { active: 1 },
					months: {
						'2026-01': { total: 2, successful: 1, states: { active: 1 } }
					},
					propsalsInLast30Days: 2,
					successfulPropsalsInLast30Days: 1
				}
			})
			.mockResolvedValueOnce({
				second: {
					name: 'Project',
					proposalsCount: 3,
					followersCount: 5,
					strategyCount: 2,
					successfulProposals: 2,
					states: { closed: 3 },
					months: {
						'2026-01': { total: 3, successful: 2, proposals: ['proposal-1'], states: { closed: 3 } }
					},
					propsalsInLast30Days: 3,
					successfulPropsalsInLast30Days: 2
				}
			})
			.mockResolvedValueOnce({})

		const result = await getGovernancePageData()

		expect(result.data).toEqual([
			{
				name: 'Project',
				proposalsCount: 5,
				followersCount: 15,
				strategyCount: 3,
				successfulProposals: 3,
				states: { active: 1, closed: 3 },
				months: {
					'2026-01': { proposals: ['proposal-1'], states: { active: 1, closed: 3 } }
				},
				proposalsInLast30Days: 5,
				successfulProposalsInLast30Days: 3,
				subRowData: { active: 1, closed: 3 }
			}
		])
	})

	it('keeps a provider outage distinct from a complete global governance overview', async () => {
		const sourceError = new Error('snapshot unavailable')
		mocks.fetchJson.mockRejectedValueOnce(sourceError).mockResolvedValueOnce({}).mockResolvedValueOnce({})

		await expect(getGovernancePageData()).rejects.toBe(sourceError)
	})

	it('does not turn a failed provider-membership index into a missing governance project', async () => {
		const sourceError = new Error('snapshot index unavailable')
		mocks.fetchJson.mockRejectedValueOnce(sourceError).mockResolvedValueOnce({}).mockResolvedValueOnce({})

		await expect(getGovernanceDetailsPageData({ project: 'project' })).rejects.toBe(sourceError)
	})
})
