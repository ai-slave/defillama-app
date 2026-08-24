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
			cliff14d: null,
			linear14d: null,
			unknownEventCount: null,
			missingPriceProtocolCount: null,
			generatedAtSec: 1779292800,
			priceSnapshotAtSec: null,
			chart: [
				{
					date: 1779292800000,
					total: 100,
					cliff: null,
					linear: null,
					unknownEventCount: null,
					missingPriceProtocolCount: null,
					breakdown: [{ token: 'ETH', value: 100, cliff: null, linear: null, pct: '100.00' }]
				}
			]
		})
	})

	it('projects the typed v2 breakdown and coverage metadata', async () => {
		const { projectHomepageUnlocksSummary } = await import('../homepageUnlocks.server')
		const chartDay = {
			date: 1779292800000,
			cliff: 40,
			linear: 60,
			total: 100,
			unknownEventCount: 1,
			missingPriceProtocolCount: 0,
			breakdown: [{ token: 'ETH', value: 100, cliff: 40, linear: 60, pct: '100.00' }]
		}

		expect(
			projectHomepageUnlocksSummary({
				schemaVersion: 2,
				generatedAtSec: 1779292800,
				priceSnapshotAtSec: 1779292800,
				windowDays: 14,
				chart: [chartDay],
				totals: {
					cliff: 40,
					linear: 60,
					total: 100,
					unknownEventCount: 1,
					missingPriceProtocolCount: 0
				},
				total14d: 100
			})
		).toEqual({
			chart: [chartDay],
			total14d: 100,
			cliff14d: 40,
			linear14d: 60,
			unknownEventCount: 1,
			missingPriceProtocolCount: 0,
			generatedAtSec: 1779292800,
			priceSnapshotAtSec: 1779292800
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
