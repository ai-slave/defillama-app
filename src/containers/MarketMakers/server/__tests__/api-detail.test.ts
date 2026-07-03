import { afterEach, describe, expect, it, vi } from 'vitest'

const forgdFetch = vi.fn()
vi.mock('../client', () => ({ forgdFetch: (...a: unknown[]) => forgdFetch(...a) }))
vi.mock('~/server/api/resultCache', () => ({
	cachedResult: (_r: string, _k: string, _o: unknown, fn: () => unknown) => fn()
}))

import { marketMakerBreakdown } from '../api'

afterEach(() => forgdFetch.mockReset())

describe('marketMakerBreakdown route', () => {
	it('forwards the id and date params to forgd and returns 200 with the payload', async () => {
		forgdFetch.mockResolvedValue({ marketMakerId: 'lhava' })
		const res = await marketMakerBreakdown.handle({
			method: 'GET',
			url: '/api/public/market-makers/breakdown/lhava?start_date=2026-05-30&end_date=2026-06-29',
			query: { id: 'lhava', start_date: '2026-05-30', end_date: '2026-06-29' },
			headers: {}
		})
		expect(res.status).toBe(200)
		expect(forgdFetch).toHaveBeenCalledWith('/market-maker/leaderboard/breakdown/lhava', {
			start_date: '2026-05-30',
			end_date: '2026-06-29'
		})
	})

	it('rejects an invalid market maker id with 400 and never calls forgd', async () => {
		const res = await marketMakerBreakdown.handle({
			method: 'GET',
			url: '/api/public/market-makers/breakdown/bad%20id',
			query: { id: 'bad id' },
			headers: {}
		})
		expect(res.status).toBe(400)
		expect(forgdFetch).not.toHaveBeenCalled()
	})
})
