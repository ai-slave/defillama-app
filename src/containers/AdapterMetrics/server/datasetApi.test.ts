import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const fetchDimensionDatasetMock = vi.hoisted(() => vi.fn())

vi.mock('./datasets', async (importOriginal) => {
	const original = await importOriginal<typeof import('./datasets')>()
	return { ...original, fetchDimensionDataset: fetchDimensionDatasetMock }
})

vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler
}))

import { createAdapterMetricDatasetHandler } from './datasetApi'

describe('adapter metric dataset API', () => {
	beforeEach(() => fetchDimensionDatasetMock.mockReset())

	test('rejects oversized chain lists before fetching the dataset', async () => {
		const handler = createAdapterMetricDatasetHandler('fees')
		const req = createMockNextApiRequest({
			method: 'GET',
			query: { chains: Array.from({ length: 51 }, (_, index) => `Chain ${index}`) }
		})
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'chains supports at most 50 values' })
		expect(fetchDimensionDatasetMock).not.toHaveBeenCalled()
	})
})
