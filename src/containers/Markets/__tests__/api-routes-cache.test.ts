import { beforeEach, describe, expect, test, vi } from 'vitest'
import { tokenMarketsList } from '../server/api'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/constants')>()
	return { ...actual, MARKETS_SERVER_URL: 'https://markets-cache.example.com' }
})

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return { ...actual, fetchJson: fetchJsonMock }
})

beforeEach(() => {
	vi.clearAllMocks()
})

describe('token markets list response cache', () => {
	test('serializes and reuses the final payload', async () => {
		fetchJsonMock.mockResolvedValueOnce({ tokens: [] })
		const request = { method: 'GET', url: '/api/public/markets/tokens', query: {}, headers: {} }

		const first = await tokenMarketsList.handle(request)
		const second = await tokenMarketsList.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: JSON.stringify({ tokens: [] }) })
		expect(second).toEqual(first)
		expect(fetchJsonMock).toHaveBeenCalledTimes(1)
		expect(fetchJsonMock).toHaveBeenCalledWith('https://markets-cache.example.com/tokens/list.json', {
			timeout: 30_000
		})
	})
})
