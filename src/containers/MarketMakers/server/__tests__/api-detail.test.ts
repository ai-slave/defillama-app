import { describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

import { marketMakerBreakdown } from '../api'

describe('marketMakerBreakdown route', () => {
	test('forwards the id and dates and reuses the serialized detail payload', async () => {
		http.serve({ '/api/v1/public/market-maker/leaderboard/breakdown/lhava': { marketMakerId: 'lhava' } })
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
		expect(http.requests[0].url.pathname).toBe('/api/v1/public/market-maker/leaderboard/breakdown/lhava')
		expect(Object.fromEntries(http.requests[0].url.searchParams)).toEqual({
			start_date: '2026-05-30',
			end_date: '2026-06-29'
		})
		expect(http.requests).toHaveLength(1)
	})

	test('rejects an invalid market maker id with 400 and never calls forgd', async () => {
		const res = await marketMakerBreakdown.handle({
			method: 'GET',
			url: '/api/public/market-makers/breakdown/bad%20id',
			query: { id: 'bad id' },
			headers: {}
		})
		expect(res.status).toBe(400)
		expect(http.requests).toHaveLength(0)
	})
})
