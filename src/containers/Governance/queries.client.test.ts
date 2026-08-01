import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

import { fetchAndFormatGovernanceData, formatGovernanceData } from './queries.client'

beforeEach(() => {
	vi.clearAllMocks()
})

describe('formatGovernanceData', () => {
	it('normalizes producer-optional proposal text and Snapshot score curve to the UI contract', () => {
		const result = formatGovernanceData({
			metadata: {},
			proposals: {
				minimal: {
					id: 'minimal',
					state: 'closed',
					start: 0,
					end: 1,
					scores: [],
					scores_total: 0,
					month: '1970-01'
				}
			}
		})

		expect(result.proposals.at(0)).toMatchObject({ title: '', link: '', discussion: '', score_curve: 0 })
	})

	it('sorts object-keyed chart months once for both governance series', () => {
		const result = formatGovernanceData({
			metadata: {},
			proposals: {
				one: {
					id: 'one',
					title: 'One',
					state: 'closed',
					link: '',
					discussion: '',
					start: 0,
					end: 0,
					scores: [25, 75],
					choices: ['No', 'Yes'],
					scores_total: 125,
					score_curve: 10,
					month: '2024-02'
				},
				two: {
					id: 'two',
					title: 'Two',
					state: 'closed',
					start: 0,
					end: 0,
					scores: [50],
					scores_total: 50,
					score_curve: 5,
					month: '2024-03'
				}
			},
			stats: {
				months: {
					'2024-03': { total: 3, successful: 2 },
					'2024-01': { total: 1, successful: 1 },
					'2024-02': { total: 2, successful: 1 }
				}
			}
		})

		expect(result.activity.map((row) => row.date)).toEqual([
			Date.UTC(2024, 0, 1) / 1000,
			Date.UTC(2024, 1, 1) / 1000,
			Date.UTC(2024, 2, 1) / 1000
		])
		expect(result.maxVotes.map((row) => row.date)).toEqual(result.activity.map((row) => row.date))
		expect(result.maxVotes.map((row) => row['Max Votes'])).toEqual([0, 125, 50])
		expect(result.proposals[0]?.totalVotes).toBe(125)
	})

	it('preserves successful source order and its provider pairing when another source fails', async () => {
		mocks.fetchJson
			.mockResolvedValueOnce({ metadata: { name: 'First' }, proposals: {} })
			.mockRejectedValueOnce(new Error('second source failed'))
			.mockResolvedValueOnce({ metadata: { name: 'Third' }, proposals: {} })

		await expect(
			fetchAndFormatGovernanceData([
				'https://example.com/governance-cache/snapshot/first',
				'https://example.com/governance-cache/compound/second',
				'https://example.com/governance-cache/tally/third'
			])
		).resolves.toMatchObject([
			{ type: 'snapshot', data: { metadata: { name: 'First' } } },
			{ type: 'tally', data: { metadata: { name: 'Third' } } }
		])
	})

	it('keeps an all-provider outage distinct from an empty governance configuration', async () => {
		const sourceError = new Error('source failed')
		mocks.fetchJson.mockRejectedValue(sourceError)

		await expect(fetchAndFormatGovernanceData(['first', 'second'])).rejects.toBe(sourceError)
		await expect(fetchAndFormatGovernanceData([])).resolves.toEqual([])
	})
})
