import { afterEach, describe, expect, it, vi } from 'vitest'

const forgdFetch = vi.fn()
vi.mock('../client', () => ({ forgdFetch: (...a: unknown[]) => forgdFetch(...a) }))
vi.mock('~/server/api/resultCache', () => ({
	cachedResult: (_r: string, _k: string, _o: unknown, fn: () => unknown) => fn()
}))

import { leaderboardVolume } from '../api'

afterEach(() => forgdFetch.mockReset())

describe('leaderboardVolume route', () => {
	it('forwards date params to forgd and returns 200 with the payload', async () => {
		forgdFetch.mockResolvedValue([{ marketMakerId: 'lhava' }])
		const res = await leaderboardVolume.handle({
			method: 'GET',
			url: '/api/public/market-makers/volume?start_date=2026-05-30&end_date=2026-06-29',
			query: { start_date: '2026-05-30', end_date: '2026-06-29' },
			headers: {}
		})
		expect(res.status).toBe(200)
		expect(forgdFetch).toHaveBeenCalledWith('/market-maker/leaderboard/volume', {
			start_date: '2026-05-30',
			end_date: '2026-06-29'
		})
	})
})
