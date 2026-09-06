import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { getEquitiesSnapshotMock, getEquitiesTablePageMock, getEquitiesTreemapPageMock } = vi.hoisted(() => ({
	getEquitiesSnapshotMock: vi.fn(),
	getEquitiesTablePageMock: vi.fn(),
	getEquitiesTreemapPageMock: vi.fn()
}))

vi.mock('~/containers/Equities/server/tableData.server', () => ({
	getEquitiesSnapshot: getEquitiesSnapshotMock,
	getEquitiesTablePage: getEquitiesTablePageMock,
	getEquitiesTreemapPage: getEquitiesTreemapPageMock
}))

import tableHandler from '~/pages/api/public/equities'
import marketMapHandler from '~/pages/api/public/equities/market-map'

const snapshot = { version: 'v1' }

beforeEach(() => {
	vi.clearAllMocks()
	getEquitiesSnapshotMock.mockResolvedValue(snapshot)
	getEquitiesTablePageMock.mockResolvedValue({ rows: [1] })
	getEquitiesTreemapPageMock.mockResolvedValue({ rows: [2] })
})

describe('equities api routes', () => {
	test('serves a table page against the shared snapshot', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/equities?page=2&search=apple',
			query: { page: '2', search: 'apple' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await tableHandler(req, res)

		expect(getEquitiesTablePageMock).toHaveBeenCalledWith(snapshot, { page: '2', search: 'apple' })
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ rows: [1] })
	})

	test('serves the market map dataset from its own route', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/equities/market-map?sizeMetric=revenueTTM',
			query: { sizeMetric: 'revenueTTM' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await marketMapHandler(req, res)

		expect(getEquitiesTreemapPageMock).toHaveBeenCalledWith(snapshot, { sizeMetric: 'revenueTTM' })
		expect(getEquitiesTablePageMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ rows: [2] })
	})

	test('answers 502 when the snapshot cannot be built', async () => {
		getEquitiesSnapshotMock.mockRejectedValue(new Error('upstream down'))
		const res = createMockNextApiResponse()

		await tableHandler({ method: 'GET', url: '/api/public/equities', query: {} } as unknown as NextApiRequest, res)

		expect(res.status).toHaveBeenCalledWith(502)
	})
})
