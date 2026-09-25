import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'
const http = installFixtureFetch()
const seed = installMetadataSeeder()
import handler from '~/pages/api/public/stablecoins/volume-chart'

beforeEach(() => {
	seed.seed({
		chainRouteKeyBySlug: { ethereum: 'ethereum', 'zksync-era': 'zksync-era' },
		chainMetadata: {
			'zksync-era': { name: 'zkSync Era', id: 'era' },
			ethereum: { name: 'Ethereum', id: 'ethereum' }
		}
	})
})

describe('/api/public/stablecoins/volume-chart', () => {
	test('serves the global token breakdown as an uppercased dollar series', async () => {
		http.serve({ [`https://stablecoins.llama.fi/chart/volume/token-breakdown`]: [[1_609_459_200, { usdt: 100 }]] })
		const req = { method: 'GET', query: { scope: 'global', chart: 'token' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				valueSymbol: '$',
				dataset: expect.objectContaining({ dimensions: ['timestamp', 'USDT'] })
			})
		)
	})

	test('returns every series only when a complete export requests it', async () => {
		const names = Array.from({ length: 55 }, (_, index) => `token-${index + 1}`)
		http.serve({
			[`https://stablecoins.llama.fi/chart/volume/chain-breakdown`]: [
				[1_609_459_200, Object.fromEntries(names.map((name, index) => [name, names.length - index]))]
			]
		})
		const req = {
			method: 'GET',
			query: { scope: 'global', chart: 'chain', all: 'true' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ dataset: expect.objectContaining({ dimensions: ['timestamp', ...names] }) })
		)
	})

	test('serves a chain-scoped currency breakdown for a known chain', async () => {
		http.serve({
			[`https://stablecoins.llama.fi/chart/volume/chain/era/currency-breakdown`]: [[1_609_459_200, { eur: 100 }]]
		})
		const req = {
			method: 'GET',
			query: { scope: 'chain', chain: 'zkSync Era', chart: 'currency' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ dataset: expect.objectContaining({ dimensions: ['timestamp', 'EUR'] }) })
		)
	})

	test('returns 404 for unknown chain params before fetching scoped volume data', async () => {
		const req = {
			method: 'GET',
			query: { scope: 'chain', chain: 'Bad Chain', chart: 'currency' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(http.requests).toEqual([])
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'chain not found' })
	})

	test('serves a token-scoped chain breakdown with chain names left as-is', async () => {
		http.serve({
			[`https://stablecoins.llama.fi/chart/volume/token/USDT/chain-breakdown`]: [[1_609_459_200, { Ethereum: 100 }]]
		})
		const req = { method: 'GET', query: { scope: 'token', token: 'USDT', chart: 'chain' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ dataset: expect.objectContaining({ dimensions: ['timestamp', 'Ethereum'] }) })
		)
	})

	test('rejects unsupported scope and chart combinations', async () => {
		const res = createMockNextApiResponse()
		await handler(
			{
				method: 'GET',
				query: { scope: 'chain', chain: 'Ethereum', chart: 'chain' }
			} as unknown as NextApiRequest,
			res
		)

		expect(http.requests).toEqual([])
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'unsupported chain volume chart' })
	})

	test('rejects unknown scopes', async () => {
		const req = { method: 'GET', query: { scope: 'bogus', chart: 'total' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'unsupported scope' })
	})
})
