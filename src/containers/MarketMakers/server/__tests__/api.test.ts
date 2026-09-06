import { afterEach, describe, expect, test, vi } from 'vitest'

const forgdFetch = vi.fn()
vi.mock('../client', () => ({ forgdFetch: (...a: Array<unknown>) => forgdFetch(...a) }))

import { leaderboardVolume, marketMakerDetails } from '../api'

afterEach(() => forgdFetch.mockReset())

describe('leaderboardVolume route', () => {
	test('forwards date params and reuses the serialized leaderboard payload', async () => {
		forgdFetch.mockResolvedValue([{ marketMakerId: 'lhava' }])
		const request = {
			method: 'GET',
			url: '/api/public/market-makers/volume?start_date=2026-05-30&end_date=2026-06-29',
			query: { start_date: '2026-05-30', end_date: '2026-06-29' },
			headers: {}
		}
		const first = await leaderboardVolume.handle(request)
		const second = await leaderboardVolume.handle({ ...request, url: `${request.url}&ignored=1` })

		expect(first).toMatchObject({ status: 200, serializedJson: JSON.stringify([{ marketMakerId: 'lhava' }]) })
		expect(second).toEqual(first)
		expect(forgdFetch).toHaveBeenCalledWith('/market-maker/leaderboard/volume', {
			start_date: '2026-05-30',
			end_date: '2026-06-29'
		})
		expect(forgdFetch).toHaveBeenCalledTimes(1)
	})

	test('reuses the serialized all-details payload', async () => {
		forgdFetch.mockResolvedValue([{ marketMakerId: 'details-cache-test' }])
		const request = {
			method: 'GET',
			url: '/api/public/market-makers/details',
			query: {},
			headers: {}
		}

		const first = await marketMakerDetails.handle(request)
		const second = await marketMakerDetails.handle({ ...request, url: `${request.url}?ignored=1` })

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect(second).toEqual(first)
		expect(forgdFetch).toHaveBeenCalledTimes(1)
	})
})
