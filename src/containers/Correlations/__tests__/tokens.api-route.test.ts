import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchCoinGeckoTokensListFromDatasetMock } = vi.hoisted(() => ({
	fetchCoinGeckoTokensListFromDatasetMock: vi.fn()
}))

vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoTokensListFromDataset: fetchCoinGeckoTokensListFromDatasetMock
}))

import handler from '~/pages/api/public/correlation/tokens'

const tokens = [
	{ id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', market_cap_rank: 1 },
	{ id: 'ethereum', name: 'Ethereum', symbol: 'eth', market_cap_rank: 2 },
	{ id: 'tether', name: 'Tether', symbol: 'usdt', market_cap_rank: 3 },
	{ id: 'dogecoin', name: 'Dogecoin', symbol: 'doge', market_cap_rank: 10 },
	{ id: 'monero', name: 'Monero', symbol: 'xmr', market_cap_rank: 20 },
	{ id: 'arbitrum', name: 'Arbitrum', symbol: 'arb', market_cap_rank: 35 }
]

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	fetchCoinGeckoTokensListFromDatasetMock.mockResolvedValue(tokens)
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('correlation tokens api route', () => {
	it('serves ranked picker fields with CDN cache headers', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/correlation/tokens?limit=2',
			query: { limit: '2' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			tokens: [
				{
					id: 'bitcoin',
					name: 'Bitcoin',
					symbol: 'BTC',
					rank: 1,
					logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/bitcoin?w=48&h=48'
				},
				{
					id: 'ethereum',
					name: 'Ethereum',
					symbol: 'ETH',
					rank: 2,
					logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/ethereum?w=48&h=48'
				}
			],
			offset: 0,
			limit: 2,
			total: 6,
			nextOffset: 2
		})
	})

	it('searches by id, name, or symbol without returning full market rows', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/correlation/tokens?q=doge&limit=20',
			query: { q: 'doge', limit: '20' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			tokens: [
				{
					id: 'dogecoin',
					name: 'Dogecoin',
					symbol: 'DOGE',
					rank: 10,
					logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/dogecoin?w=48&h=48'
				}
			],
			offset: 0,
			limit: 20,
			total: 1,
			nextOffset: null
		})
		expect(res.json.mock.calls[0][0].tokens[0]).not.toHaveProperty('market_cap_rank')
	})

	it('hydrates selected ids outside the initial page in ranking order', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/correlation/tokens?ids=monero,bitcoin,missing',
			query: { ids: 'monero,bitcoin,missing' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json.mock.calls[0][0].tokens.map((token) => token.id)).toEqual(['bitcoin', 'monero'])
		expect(res.json.mock.calls[0][0].nextOffset).toBeNull()
	})
})
