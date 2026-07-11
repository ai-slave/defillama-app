import { afterEach, describe, expect, it, vi } from 'vitest'

const forgdFetch = vi.fn()
vi.mock('../client', () => ({ forgdFetch: (...a: unknown[]) => forgdFetch(...a) }))

import { marketMakerBreakdown } from '../api'

afterEach(() => forgdFetch.mockReset())

describe('marketMakerBreakdown route', () => {
	it('forwards the id and dates and reuses the serialized detail payload', async () => {
		forgdFetch.mockResolvedValue({ marketMakerId: 'lhava' })
		const request = {
			method: 'GET',
			url: '/api/public/market-makers/breakdown/lhava?start_date=2026-05-30&end_date=2026-06-29',
			query: { id: 'lhava', start_date: '2026-05-30', end_date: '2026-06-29' },
			headers: {}
		}
		const first = await marketMakerBreakdown.handle(request)
		const second = await marketMakerBreakdown.handle({ ...request, url: `${request.url}&ignored=1` })

		expect(first).toMatchObject({ status: 200, serializedJson: JSON.stringify({ marketMakerId: 'lhava' }) })
		expect(second).toEqual(first)
		expect(forgdFetch).toHaveBeenCalledWith('/market-maker/leaderboard/breakdown/lhava', {
			start_date: '2026-05-30',
			end_date: '2026-06-29'
		})
		expect(forgdFetch).toHaveBeenCalledTimes(1)
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
