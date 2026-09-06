import { beforeEach, describe, expect, test, vi } from 'vitest'

const fetchJson = vi.hoisted(() => vi.fn())

vi.mock('~/constants', () => ({ YIELDS_V2_SERVER_URL: 'https://yields.example' }))
vi.mock('~/utils/async', () => ({ fetchJson }))

import { fetchTrendsFromNetwork } from '../fetchers'

beforeEach(() => {
	vi.clearAllMocks()
	fetchJson.mockResolvedValue({ data: [{ pool: 'pool-1' }] })
})

describe('Yields v2 network fetchers', () => {
	test('uses the standard retry count by default', async () => {
		await fetchTrendsFromNetwork({ timeout: 1000 })

		expect(fetchJson).toHaveBeenCalledWith('https://yields.example/v2/earn/trends', { timeout: 1000 }, false)
	})

	test('passes the snapshot extra-retry option separately from request options', async () => {
		await fetchTrendsFromNetwork({ extraRetry: true, timeout: 1000 })

		expect(fetchJson).toHaveBeenCalledWith('https://yields.example/v2/earn/trends', { timeout: 1000 }, true)
	})
})
