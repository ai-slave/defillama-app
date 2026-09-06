import assert from 'node:assert/strict'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiRequest } from '~/server/api/types'
import { createUtrLeaderboardApi } from '../api'
import type { UtrLeaderboardApiRow, UtrLeaderboardResponse } from '../types'

function row(overrides: Partial<UtrLeaderboardApiRow> = {}): UtrLeaderboardApiRow {
	return {
		rank: 1,
		arcticId: 'project-1',
		projectName: 'Uniswap',
		symbol: 'uni',
		sector: 'DEX',
		tgeStatus: 'post',
		coingeckoId: 'uniswap',
		cmcId: null,
		notRated: false,
		grade: 'AAA',
		disclosureGrade: 'AAA',
		performanceGrade: 'AA',
		overallScore: 60.2,
		momChangePct: 1.5,
		disclosureScore: 7.8,
		performanceScore: 7.6,
		fdvUsd: 3_800_000_000,
		asOf: '2026-08-27T00:00:00.000Z',
		gradedCount: 13,
		criteriaCount: 13,
		disclosureCategories: [],
		performanceCategories: [],
		...overrides
	}
}

const leaderboard: UtrLeaderboardResponse = {
	configVersion: 18,
	generatedAt: '2026-08-27T00:00:00.000Z',
	scoredCount: 2,
	totalCount: 2,
	postTge: { rows: [row()] },
	preTge: {
		rows: [
			row({
				rank: 1,
				arcticId: 'project-2',
				projectName: 'Upcoming',
				symbol: 'up',
				tgeStatus: 'pre',
				coingeckoId: null,
				fdvUsd: null
			})
		]
	}
}

function request(authorization?: string): ApiRequest {
	return {
		method: 'GET',
		url: '/api/private/utr/leaderboard',
		query: {},
		headers: authorization ? { authorization } : {}
	}
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('UTR leaderboard API', () => {
	test('fails closed when the inbound API key is not configured', async () => {
		const fetchLeaderboard = vi.fn(async () => leaderboard)
		const result = await createUtrLeaderboardApi(fetchLeaderboard).handle(request())

		expect(result).toMatchObject({ status: 503, body: { error: 'UTR leaderboard API is not configured' } })
		expect(fetchLeaderboard).not.toHaveBeenCalled()
	})

	test('rejects missing and incorrect bearer credentials before loading data', async () => {
		vi.stubEnv('UTR_LEADERBOARD_API_KEY', 'utr_test_secret')
		const fetchLeaderboard = vi.fn(async () => leaderboard)
		const route = createUtrLeaderboardApi(fetchLeaderboard)

		await expect(route.handle(request())).resolves.toMatchObject({ status: 401 })
		await expect(route.handle(request('Bearer wrong'))).resolves.toMatchObject({ status: 401 })
		expect(fetchLeaderboard).not.toHaveBeenCalled()
	})

	test('returns the normalized rows shown by the leaderboard table', async () => {
		vi.stubEnv('UTR_LEADERBOARD_API_KEY', 'utr_test_secret')
		const result = await createUtrLeaderboardApi(async () => leaderboard).handle(request('Bearer utr_test_secret'))

		expect(result.status).toBe(200)
		expect(result.headers?.['Cache-Control']).toBe('private, no-store, max-age=0')
		assert('body' in result, 'Expected a JSON body')
		expect(result.body).toMatchObject({
			configVersion: 18,
			generatedAt: '2026-08-27T00:00:00.000Z',
			scoredCount: 2,
			totalCount: 2,
			rows: [
				{
					rank: 1,
					asset: 'uniswap',
					projectName: 'Uniswap',
					symbol: 'UNI',
					grade: 'AAA',
					overallScore: 60.2,
					overallMomChangePct: 1.5,
					disclosureScore: 7.8,
					performanceScore: 7.6,
					fdvUsd: 3_800_000_000
				},
				{
					rank: 2,
					asset: 'project-2',
					projectName: 'Upcoming',
					listingStatus: 'pre-tge'
				}
			]
		})
		expect(JSON.stringify(result.body)).not.toContain('disclosureCategories')
		expect(JSON.stringify(result.body)).not.toContain('iconDataUrl')
	})

	test('returns 502 instead of an empty leaderboard when Forgd fails', async () => {
		vi.stubEnv('UTR_LEADERBOARD_API_KEY', 'utr_test_secret')
		const result = await createUtrLeaderboardApi(async () => {
			throw new Error('Forgd unavailable')
		}).handle(request('Bearer utr_test_secret'))

		expect(result).toMatchObject({ status: 502, body: { error: 'Failed to load UTR leaderboard' } })
	})
})
