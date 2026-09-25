import { afterEach, describe, expect, test, vi } from 'vitest'

const fetchJson = vi.fn()
vi.mock('~/utils/async', () => ({ fetchJson: (...args: Array<unknown>) => fetchJson(...args) }))

import {
	exchangeOptionsFromScoringConfig,
	fetchUtrDisclosures,
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
	test('loads claim options with the Forgd bearer key', async () => {
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
		expect(exchangeOptionsFromScoringConfig(scoringConfig)).toEqual([
			{ id: 'binance', displayName: 'Binance' },
			{ id: 'kraken', displayName: 'Kraken' }
		])
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

	test('returns empty results when the project API is unavailable', async () => {
		fetchJson.mockRejectedValue(new Error('unavailable'))

		await expect(fetchUtrProjects()).resolves.toEqual([])
		await expect(fetchUtrDisclosureScoreSummaries()).resolves.toEqual([])
		await expect(fetchUtrScoringConfig()).resolves.toBeNull()
		expect(exchangeOptionsFromScoringConfig(null)).toEqual([])
		await expect(fetchUtrUniverseWithLive()).resolves.toEqual({ rows: [], scoredCount: 0, totalCount: 0 })
	})

	test('loads the leaderboard with the Forgd bearer key and preserves upstream failures', async () => {
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

	test('normalizes disclosed records from the Forgd disclosures endpoint', async () => {
		vi.stubEnv('API_KEY_FORGD', 'qk_test_123')
		fetchJson.mockResolvedValueOnce({
			arcticId: 'arctic-1',
			updatedAt: '2026-08-21T08:51:21.248Z',
			disclosures: {
				insiderIdentities: [
					{ name: 'Amir Haleem', role: 'Founder', profileUrl: 'https://x.com/amirhaleem', description: '' }
				],
				multisigWallets: [
					{
						walletAddress: '0x7951c7ef839e26F63DA87a42C9a87986507f1c07',
						thresholdRequired: '7',
						thresholdTotal: '12',
						signerNames: 'N/A'
					},
					{ walletAddress: 'N/A', thresholdRequired: '-', thresholdTotal: '-', signerNames: 'Unknown' }
				],
				externalAllocations: [
					{ counterpartyName: 'A16Z', allocationPct: 'Not Disclosed', categorization: 'Investor' },
					{ counterpartyName: 'Binance', allocationPct: '15.85%', categorization: 'Service Provider' },
					{ counterpartyName: 'Advisors', allocationPct: 'Share of 2.25% aggregate', categorization: 'Advisor' }
				],
				exchangeEngagements: [
					{
						exchangeName: 'Binance',
						exchangeLogoUrl: 'https://cdn/binance.png',
						commercialCommitment: true,
						details: '',
						commentary: 'hidden'
					}
				],
				tokenomicsGroups: [
					{
						groupName: 'Core Contributors',
						allocationPct: 20,
						groupCategory: 'Airdrop',
						tgeUnlockPct: 0,
						lockUpDurationMonths: 12,
						cliffUnlockPct: 4.16,
						unlockDurationMonths: 24,
						unlockFrequency: 'Monthly'
					}
				],
				vestingActualCommentary: ' Matches the schedule. ',
				cashFlowCommentary: 'N/A'
			}
		})

		const disclosures = await fetchUtrDisclosures('arctic-1')
		expect(fetchJson).toHaveBeenCalledWith(
			'https://quant.forgd.com/api/v1/public/utr/disclosures/arctic-1',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)
		expect(disclosures?.insiderIdentities).toEqual([
			{ name: 'Amir Haleem', role: 'Founder', profileUrl: 'https://x.com/amirhaleem', description: null }
		])
		expect(disclosures?.multisigWallets).toEqual([
			{ walletAddress: '0x7951c7ef839e26F63DA87a42C9a87986507f1c07', thresholdRequired: 7, thresholdTotal: 12 }
		])
		expect(disclosures?.externalAllocations.map((row) => row.allocationPct)).toEqual([
			null,
			15.85,
			'Share of 2.25% aggregate'
		])
		expect(disclosures?.exchangeEngagements).toEqual([
			{ exchangeName: 'Binance', logoUrl: 'https://cdn/binance.png', commercialCommitment: true, details: null }
		])
		expect(disclosures?.tokenomicsGroups[0].groupCategory).toBe('Airdrop')
		expect(disclosures?.vestingActualCommentary).toBe('Matches the schedule.')
		expect(disclosures?.cashFlowCommentary).toBeNull()
	})

	test('treats a missing disclosure record as nothing disclosed and a failed request as unknown', async () => {
		fetchJson.mockResolvedValueOnce({
			arcticId: 'arctic-2',
			disclosures: null,
			updatedAt: null,
			warning: 'No disclosure data has been submitted for this asset yet.'
		})
		const missing = await fetchUtrDisclosures('arctic-2')
		expect(missing?.insiderIdentities).toEqual([])
		expect(missing?.tokenomicsGroups).toEqual([])
		expect(missing?.vestingActualCommentary).toBeNull()

		fetchJson.mockRejectedValueOnce(new Error('[503]'))
		await expect(fetchUtrDisclosures('arctic-2')).resolves.toBeNull()
	})
})
