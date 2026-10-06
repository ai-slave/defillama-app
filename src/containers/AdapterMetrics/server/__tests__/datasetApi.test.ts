import { describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
// An unserved fetch fails, so a handler that fetched before validating would not answer 400.
installFixtureFetch()

import { createAdapterMetricDatasetHandler } from '../datasetApi'

describe('adapter metric dataset API', () => {
	test('rejects oversized chain lists', async () => {
		const handler = createAdapterMetricDatasetHandler('fees')
		const req = createMockNextApiRequest({
			method: 'GET',
			query: { chains: Array.from({ length: 51 }, (_, index) => `Chain ${index}`) }
		})
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'chains supports at most 50 values' })
	})
})
