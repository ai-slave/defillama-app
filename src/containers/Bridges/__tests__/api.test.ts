import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import { fetchBridgeDayStats, fetchBridgeVolumeByChain } from '../api'

vi.mock('~/utils/async', () => ({
	fetchJson: vi.fn()
}))

describe('fetchBridgeDayStats', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
		vi.mocked(fetchJson).mockResolvedValue({})
	})

	it('uses UTC midnight in the request URL', async () => {
		const timestamp = Date.parse('2026-07-19T16:42:00Z') / 1000
		const utcMidnight = Date.parse('2026-07-19T00:00:00Z') / 1000

		await fetchBridgeDayStats(timestamp, 'Base')

		expect(fetchJson).toHaveBeenCalledOnce()
		expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining(`/bridgedaystats/${utcMidnight}/Base`))
	})
})

describe('fetchBridgeVolumeByChain', () => {
	beforeEach(() => {
		vi.mocked(fetchJson).mockReset()
	})

	it('discards cache metadata returned instead of chart data', async () => {
		vi.mocked(fetchJson).mockResolvedValue({ cacheTTL: 4200, storedAt: 1_784_711_608_405 })

		await expect(fetchBridgeVolumeByChain('Ethereum')).resolves.toEqual([])
	})

	it('preserves valid chart arrays, including empty arrays', async () => {
		const chart = [{ date: '1784678400', depositUSD: 10, withdrawUSD: 4 }]
		vi.mocked(fetchJson).mockResolvedValueOnce(chart).mockResolvedValueOnce([])

		await expect(fetchBridgeVolumeByChain('Arbitrum')).resolves.toBe(chart)
		await expect(fetchBridgeVolumeByChain('Zkfair')).resolves.toEqual([])
	})
})
