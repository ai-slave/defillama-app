import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/constants', () => ({
	DATASETS_SERVER_URL: 'https://defillama-datasets.llama.fi'
}))

vi.mock('~/utils/async', () => ({
	fetchJson: fetchJsonMock,
	getFastJsonTimeoutMs: () => 1234
}))

describe('homepage unlocks summary', () => {
	afterEach(() => {
		fetchJsonMock.mockReset()
		vi.restoreAllMocks()
	})

	it('parses a valid homepage unlocks summary', async () => {
		const { projectHomepageUnlocksSummary } = await import('../homepageUnlocks.server')

		expect(
			projectHomepageUnlocksSummary({
				schemaVersion: 1,
				generatedAtSec: 1779292800,
				windowDays: 14,
				total14d: 100,
				chart: [
					{
						date: 1779292800000,
						total: 100,
						breakdown: [{ token: 'ETH', value: 100, pct: '100.00' }]
					}
				]
			})
		).toEqual({
			total14d: 100,
			chart: [
				{
					date: 1779292800000,
					total: 100,
					breakdown: [{ token: 'ETH', value: 100, pct: '100.00' }]
				}
			]
		})
	})

	it('returns null when the homepage unlocks artifact fetch fails', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
		fetchJsonMock.mockRejectedValue(new Error('not found'))
		const { fetchHomepageUnlocksSummary } = await import('../homepageUnlocks.server')

		await expect(fetchHomepageUnlocksSummary()).resolves.toBeNull()
		expect(fetchJsonMock).toHaveBeenCalledWith('https://defillama-datasets.llama.fi/homepage/unlocks-summary.json', {
			timeout: 1234
		})
		expect(error).toHaveBeenCalled()
	})
})
