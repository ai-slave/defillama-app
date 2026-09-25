import { describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
const http = installFixtureFetch()

import { leaderboardVolume, marketMakerDetails } from '../api'

describe('leaderboardVolume route', () => {
	test('forwards date params and reuses the serialized leaderboard payload', async () => {
		http.serve({ '/api/v1/public/market-maker/leaderboard/volume': [{ marketMakerId: 'lhava' }] })
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
		expect(http.requests[0].url.pathname).toBe('/api/v1/public/market-maker/leaderboard/volume')
		expect(Object.fromEntries(http.requests[0].url.searchParams)).toEqual({
			start_date: '2026-05-30',
			end_date: '2026-06-29'
		})
		expect(http.requests).toHaveLength(1)

		// Another date range is a different leaderboard, never the cached one.
		await leaderboardVolume.handle({
			...request,
			url: '/api/public/market-makers/volume?start_date=2026-04-01&end_date=2026-04-30',
			query: { start_date: '2026-04-01', end_date: '2026-04-30' }
		})
		expect(http.requests.map((upstream) => upstream.url.searchParams.get('start_date'))).toEqual([
			'2026-05-30',
			'2026-04-01'
		])
	})

	test('reuses the serialized all-details payload', async () => {
		http.serve({ '/api/v1/public/market-maker/details': [{ marketMakerId: 'details-cache-test' }] })
		const request = {
			method: 'GET',
			url: '/api/public/market-makers/details',
			query: {},
			headers: {}
		}

		const first = await marketMakerDetails.handle(request)
		const second = await marketMakerDetails.handle({ ...request, url: `${request.url}?ignored=1` })

		expect(first).toMatchObject({
			status: 200,
			serializedJson: JSON.stringify([{ marketMakerId: 'details-cache-test' }])
		})
		expect(second).toEqual(first)
		expect(http.requests).toHaveLength(1)
	})
})
