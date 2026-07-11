import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resultBody } from '~/server/api/__tests__/resultBody'
import { chartLendBorrowDataset, holdersByConfigDataset } from '../server/api'

const fetchWithPoolingOnServerMock = vi.hoisted(() => vi.fn())

vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer: fetchWithPoolingOnServerMock }))

beforeEach(() => {
	vi.clearAllMocks()
	fetchWithPoolingOnServerMock.mockImplementation(
		async (url: string) => new Response(JSON.stringify({ url, points: [[1, 2]] }), { status: 200 })
	)
})

describe('config-specific yields serialized response caches', () => {
	it.each([
		['lend-borrow chart', chartLendBorrowDataset, '11111111-1111-4111-8111-111111111111', '/chartLendBorrow/'],
		['holder history', holdersByConfigDataset, '22222222-2222-4222-8222-222222222222', '/holders/']
	])('serializes and reuses the final payload for %s', async (_label, route, configID, upstreamPath) => {
		const request = {
			method: 'GET',
			url: route.route.replace('[configID]', configID),
			query: { configID },
			headers: {}
		}

		const first = await route.handle(request)
		const second = await route.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect(resultBody(first)).toMatchObject({ points: [[1, 2]] })
		expect(second).toEqual(first)
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledTimes(1)
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith(`https://yields.llama.fi${upstreamPath}${configID}`)
	})
})
