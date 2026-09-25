import { describe, expect, test, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'
import { installTelemetrySink } from '~/utils/test/telemetry'

vi.mock('~/server/db/llama', () => ({
	llamaDb: {
		query: () => {
			throw new Error('Unexpected database request')
		}
	}
}))

import { cexDatasetApiHandler } from './datasetApi'

const telemetry = installTelemetrySink()

describe('/api/dynamic/cexs', () => {
	test('keeps unavailable assets null and measured zero distinct', async () => {
		telemetry.serve({
			'/cexs': {
				cexs: [
					{ name: 'Unavailable' },
					{ name: 'Measured zero', currentTvl: 0, cleanAssetsTvl: 0, inflows_24h: 0 },
					{ name: 'Measured assets', currentTvl: 20, cleanAssetsTvl: 10, inflows_24h: 5 }
				],
				cg_volume_cexs: []
			}
		})
		const req = createMockNextApiRequest({ method: 'GET' })
		const res = createMockNextApiResponse()

		await cexDatasetApiHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([
			expect.objectContaining({ name: 'Measured assets', tvl: 20, cleanTvl: 10, '24hInflows': 5 }),
			expect.objectContaining({ name: 'Measured zero', tvl: 0, cleanTvl: 0, '24hInflows': 0 }),
			expect.objectContaining({ name: 'Unavailable', tvl: null, cleanTvl: null, '24hInflows': null })
		])
	})

	test('returns an error when the whole CEX source fails', async () => {
		const error = new Error('source unavailable')
		telemetry.serve({
			'/cexs': () => {
				throw error
			}
		})
		const req = createMockNextApiRequest({ method: 'GET' })
		const res = createMockNextApiResponse()

		await cexDatasetApiHandler(req, res)

		expect(await telemetry.events()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'runtime_error',
					phase: 'apiRoute',
					error_message: expect.stringContaining(error.message)
				})
			])
		)
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch cex data' })
	})
})
