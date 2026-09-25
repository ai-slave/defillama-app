import { describe, expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { tokenMarketsList } from '../server/api'
const http = installFixtureFetch()

describe('token markets list response cache', () => {
	test('serializes and reuses the final payload', async () => {
		http.serve({ [`${MARKETS_SERVER_URL}/tokens/list.json`]: { tokens: [] } })
		const request = { method: 'GET', url: '/api/public/markets/tokens', query: {}, headers: {} }

		const first = await tokenMarketsList.handle(request)
		const second = await tokenMarketsList.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: JSON.stringify({ tokens: [] }) })
		expect(second).toEqual(first)
		expect(http.urls()).toEqual([`${MARKETS_SERVER_URL}/tokens/list.json`])
	})
})
