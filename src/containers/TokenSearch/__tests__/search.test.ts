import { describe, expect, test, vi } from 'vitest'

// constants read the search token at import time; without it searchApi skips the request.
vi.hoisted(() => {
	process.env.NEXT_PUBLIC_SEARCH_API_TOKEN = 'test-token'
})

import { SEARCH_API_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

import { getGeckoIdFromSearchId, getTokenSearchFallback, hydrateTokenSearchOptionsByIds } from '../search'

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
		const bnbHit = {
			id: 'coingecko_binancecoin_token',
			name: 'BNB',
			symbol: 'BNB',
			logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/binancecoin?w=48&h=48'
		}
		// Meili only finds BNB by its display symbol, not by the legacy CoinGecko id.
		http.serve({
			[SEARCH_API_URL]: (_url: URL, init?: RequestInit) => ({
				results: JSON.parse(init!.body as string).queries.map(({ q }: { q: string }) => ({
					hits: q === 'bnb' ? [bnbHit] : []
				}))
			})
		})

		const [token] = await hydrateTokenSearchOptionsByIds(['binancecoin'])

		expect(token).toMatchObject({
			id: 'binancecoin',
			name: 'BNB',
			symbol: 'BNB'
		})
	})
})
