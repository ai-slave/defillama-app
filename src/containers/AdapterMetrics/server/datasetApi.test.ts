import { describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'
const http = installFixtureFetch()

import { createAdapterMetricDatasetHandler } from './datasetApi'

describe('adapter metric dataset API', () => {
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
		expect(http.requests).toHaveLength(0)
	})
})
