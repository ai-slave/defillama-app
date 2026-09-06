import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchGlobalMock, fetchChainMock, fetchTokenMock } = vi.hoisted(() => ({
	fetchGlobalMock: vi.fn(),
	fetchChainMock: vi.fn(),
	fetchTokenMock: vi.fn()
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: {
		chainRouteKeyBySlug: {
			ethereum: 'ethereum',
			'zksync-era': 'zksync-era'
		},
		chainMetadata: {
			'zksync-era': { name: 'zkSync Era', id: 'era' },
			ethereum: { name: 'Ethereum', id: 'ethereum' }
		}
	}
}))

vi.mock('~/containers/Stablecoins/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/Stablecoins/api')>()
	return {
		...actual,
		fetchStablecoinVolumeChartApi: fetchGlobalMock,
		fetchStablecoinChainVolumeChartApi: fetchChainMock,
		fetchStablecoinTokenVolumeChartApi: fetchTokenMock
	}
})

import handler from '~/pages/api/public/stablecoins/volume-chart'

const volumeData = [
	[1_609_459_200, 100],
	[1_609_545_600, 125]
]

beforeEach(() => {
	vi.clearAllMocks()
	fetchGlobalMock.mockResolvedValue(volumeData)
	fetchChainMock.mockResolvedValue(volumeData)
	fetchTokenMock.mockResolvedValue(volumeData)
})

describe('/api/public/stablecoins/volume-chart', () => {
	test('uses global volume fetchers', async () => {
		const req = { method: 'GET', query: { scope: 'global', chart: 'token' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchGlobalMock).toHaveBeenCalledWith('token')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valueSymbol: '$' }))
	})

	test('returns every series only when a complete export requests it', async () => {
		const names = Array.from({ length: 55 }, (_, index) => `token-${index + 1}`)
		fetchGlobalMock.mockResolvedValueOnce([
			[1_609_459_200, Object.fromEntries(names.map((name, index) => [name, names.length - index]))]
		])
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

	test('uses chain scoped volume fetchers', async () => {
		const req = {
			method: 'GET',
			query: { scope: 'chain', chain: 'zkSync Era', chart: 'currency' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainMock).toHaveBeenCalledWith('zkSync Era', 'currency', expect.any(Object))
		expect(res.status).toHaveBeenCalledWith(200)
	})

	test('returns 404 for unknown chain params before fetching scoped volume data', async () => {
		const req = {
			method: 'GET',
			query: { scope: 'chain', chain: 'Bad Chain', chart: 'currency' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchChainMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'chain not found' })
	})

	test('uses token scoped volume fetchers', async () => {
		const req = { method: 'GET', query: { scope: 'token', token: 'USDT', chart: 'chain' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchTokenMock).toHaveBeenCalledWith('USDT', 'chain')
		expect(res.status).toHaveBeenCalledWith(200)
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

		expect(fetchChainMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'unsupported chain volume chart' })
	})

	test('rejects unsupported global volume charts', async () => {
		const req = { method: 'GET', query: { scope: 'global', chart: 'unsupported' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchGlobalMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'unsupported global volume chart' })
	})

	test('rejects unsupported token volume charts', async () => {
		const req = {
			method: 'GET',
			query: { scope: 'token', token: 'USDC', chart: 'currency' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchTokenMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'unsupported token volume chart' })
	})

	test('rejects unknown scopes', async () => {
		const req = { method: 'GET', query: { scope: 'bogus', chart: 'total' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'unsupported scope' })
	})
})
