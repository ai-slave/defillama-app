import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchJson = vi.fn()
vi.mock('~/utils/async', () => ({ fetchJson: (...args: unknown[]) => fetchJson(...args) }))

import {
	fetchUtrDisclosureScoreSummaries,
	fetchUtrExchangeOptions,
	fetchUtrProjects,
	fetchUtrUniverseWithLive
} from '../server'

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
			.mockResolvedValueOnce({
				exchanges: {
					tier1: [{ displayName: 'Binance' }],
					tier2: [{ displayName: 'Kraken' }]
				}
			})

		await expect(fetchUtrProjects()).resolves.toEqual([{ arcticId: 'project-1', projectName: 'Ethereum' }])
		await expect(fetchUtrDisclosureScoreSummaries()).resolves.toEqual([
			{ arcticId: 'project-1', disclosureScore: 8.72 }
		])
		await expect(fetchUtrExchangeOptions()).resolves.toEqual(['Binance', 'Kraken'])
		expect(fetchJson).toHaveBeenNthCalledWith(
			1,
			'https://dev.quant.api.forgd.com/api/utr/projects',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)
		expect(fetchJson).toHaveBeenNthCalledWith(
			2,
			'https://dev.quant.api.forgd.com/api/utr/projects/disclosure-scores',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)
		expect(fetchJson).toHaveBeenNthCalledWith(
			3,
			'https://dev.quant.api.forgd.com/api/utr/scoring-config',
			expect.objectContaining({ headers: { Authorization: 'Bearer qk_test_123' } })
		)
	})

	it('returns empty results when the project API is unavailable', async () => {
		fetchJson.mockRejectedValue(new Error('unavailable'))

		await expect(fetchUtrProjects()).resolves.toEqual([])
		await expect(fetchUtrDisclosureScoreSummaries()).resolves.toEqual([])
		await expect(fetchUtrExchangeOptions()).resolves.toEqual([])
		await expect(fetchUtrUniverseWithLive()).resolves.toEqual({ rows: [], scoredCount: 0, totalCount: 0 })
	})
})
