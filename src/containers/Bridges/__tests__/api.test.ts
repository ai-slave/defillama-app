import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson } from '~/utils/async'
import { fetchBridgeDayStats } from '../api'

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
