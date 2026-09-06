import { beforeEach, describe, expect, test, vi } from 'vitest'

const searchApiMock = vi.hoisted(() => vi.fn())

vi.mock('~/api', () => ({
	searchApi: searchApiMock
}))

import { getGeckoIdFromSearchId, getTokenSearchFallback, hydrateTokenSearchOptionsByIds } from './search'

beforeEach(() => {
	searchApiMock.mockReset()
})

describe('token search id normalization', () => {
	test('converts Meili token ids to bare CoinGecko ids', () => {
		expect(getGeckoIdFromSearchId('coingecko_binancecoin:token')).toBe('binancecoin')
		expect(getGeckoIdFromSearchId('coingecko_binancecoin_token')).toBe('binancecoin')
		expect(getGeckoIdFromSearchId('coingecko:bitcoin:token')).toBe('bitcoin')
	})

	test('leaves existing bare CoinGecko ids usable for direct route hydration', () => {
		expect(getGeckoIdFromSearchId('solana')).toBe('solana')
		expect(getTokenSearchFallback('coingecko:ethereum:token').id).toBe('ethereum')
	})

	test('uses readable fallback names for URL-selected tokens', () => {
		expect(getTokenSearchFallback('bitcoin').name).toBe('Bitcoin')
		expect(getTokenSearchFallback('render-token').name).toBe('Render Token')
	})

	test('uses aliases only to search display metadata for legacy CoinGecko ids', async () => {
		searchApiMock.mockResolvedValueOnce([
			{
				id: 'coingecko_binancecoin_token',
				name: 'BNB',
				symbol: 'BNB',
				logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/binancecoin?w=48&h=48'
			}
		])

		const [token] = await hydrateTokenSearchOptionsByIds(['binancecoin'])

		expect(searchApiMock).toHaveBeenCalledWith(
			expect.objectContaining({
				q: 'bnb',
				limit: 10,
				filter: [['type = "Token"']]
			})
		)
		expect(token).toMatchObject({
			id: 'binancecoin',
			name: 'BNB',
			symbol: 'BNB'
		})
	})
})
