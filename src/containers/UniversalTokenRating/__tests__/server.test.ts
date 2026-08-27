import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchJson = vi.fn()
vi.mock('~/utils/async', () => ({ fetchJson: (...args: unknown[]) => fetchJson(...args) }))

import {
	exchangeOptionsFromScoringConfig,
	fetchUtrDisclosureScoreSummaries,
	fetchUtrLeaderboardStrict,
	fetchUtrProjects,
	fetchUtrScoringConfig,
	fetchUtrUniverseWithLive
} from '../server'

const rawScoringConfig = {
	version: 18,
	config: {
		grading: {
			overall: {
				description: 'Overall confidence',
				scale: [
					{ min: 60, grade: 'AAA', interpretation: 'Highest confidence' },
					{ min: null, grade: 'CCC', interpretation: 'Very low confidence' }
				]
			},
			disclosure: { description: 'Disclosure quality', scale: [] },
			performance: { description: 'Performance quality', scale: [] }
		},
		disclosure: {
			categories: [
				{
					key: 'core_contributors',
					label: 'Core Contributors',
					criteria: [
						{
							key: 'team_identities',
							label: 'Insider Identities Disclosed',
							weight: 0.05,
							applicability: 'both',
							definition: 'Who is on the team.',
							rubric: ['All named', 'Partially named']
						}
					]
				}
			]
		},
		performance: {
			categories: [
				{
					key: 'total_market',
					label: 'Total Market',
					criteria: [
						{
							key: 'volume_mcap',
							label: 'Total Volume',
							weight: 0.1,
							applicability: 'postTge'
						}
					]
				}
			]
		}
	},
	exchanges: {
		tier1: [{ id: 'binance', displayName: 'Binance', logoUrl: 'https://example.com/binance.png' }],
		tier2: [{ id: 'kraken', displayName: 'Kraken', logoUrl: null }]
	}
}

afterEach(() => {
	vi.unstubAllEnvs()
	fetchJson.mockReset()
})

describe('UTR project API', () => {
	it('loads claim options with the Forgd bearer key', async () => {
		vi.stubEnv('API_KEY_FORGD', 'qk_test_123')
		fetchJson
			.mockResolvedValueOnce([{ arcticId: 'project-1', projectName: 'Ethereum' }])
			.mockResolvedValueOnce([{ arcticId: 'project-1', disclosureScore: 8.72 }])
			.mockResolvedValueOnce(rawScoringConfig)

		await expect(fetchUtrProjects()).resolves.toEqual([{ arcticId: 'project-1', projectName: 'Ethereum' }])
		await expect(fetchUtrDisclosureScoreSummaries()).resolves.toEqual([
			{ arcticId: 'project-1', disclosureScore: 8.72 }
		])
		const scoringConfig = await fetchUtrScoringConfig()
		expect(scoringConfig?.version).toBe(18)
		expect(scoringConfig?.grading.overall.scale.at(-1)?.min).toBeNull()
		expect(scoringConfig?.disclosure.categories[0].criteria[0]).toMatchObject({
			weight: 0.05,
			applicability: 'both',
			definition: 'Who is on the team.',
			rubric: ['All named', 'Partially named']
		})
		expect(scoringConfig?.performance.categories[0].criteria[0].applicability).toBe('postTge')
		expect(exchangeOptionsFromScoringConfig(scoringConfig)).toEqual(['Binance', 'Kraken'])
		expect(fetchJson).toHaveBeenNthCalledWith(
			1,
			'https://quant.forgd.com/api/utr/projects',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)
		expect(fetchJson).toHaveBeenNthCalledWith(
			2,
			'https://quant.forgd.com/api/utr/projects/disclosure-scores',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)
		expect(fetchJson).toHaveBeenNthCalledWith(
			3,
			'https://quant.forgd.com/api/utr/scoring-config',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)
	})

	it('returns empty results when the project API is unavailable', async () => {
		fetchJson.mockRejectedValue(new Error('unavailable'))

		await expect(fetchUtrProjects()).resolves.toEqual([])
		await expect(fetchUtrDisclosureScoreSummaries()).resolves.toEqual([])
		await expect(fetchUtrScoringConfig()).resolves.toBeNull()
		expect(exchangeOptionsFromScoringConfig(null)).toEqual([])
		await expect(fetchUtrUniverseWithLive()).resolves.toEqual({ rows: [], scoredCount: 0, totalCount: 0 })
	})

	it('loads the leaderboard with the Forgd bearer key and preserves upstream failures', async () => {
		vi.stubEnv('API_KEY_FORGD', 'qk_test_123')
		const payload = {
			configVersion: 18,
			generatedAt: '2026-08-27T00:00:00.000Z',
			scoredCount: 0,
			totalCount: 0,
			postTge: { rows: [] },
			preTge: { rows: [] }
		}
		fetchJson.mockResolvedValueOnce(payload)

		await expect(fetchUtrLeaderboardStrict()).resolves.toEqual(payload)
		expect(fetchJson).toHaveBeenCalledWith(
			'https://quant.forgd.com/api/utr/leaderboard',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)

		fetchJson.mockRejectedValueOnce(new Error('upstream failed'))
		await expect(fetchUtrLeaderboardStrict()).rejects.toThrow('upstream failed')
	})
})
