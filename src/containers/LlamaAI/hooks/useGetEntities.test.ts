import { beforeEach, describe, expect, it, vi } from 'vitest'

const { searchTokens } = vi.hoisted(() => ({ searchTokens: vi.fn() }))

vi.mock('~/containers/TokenSearch/search', () => ({ searchTokens }))

import { fetchCoins } from './useGetEntities'

describe('fetchCoins', () => {
	beforeEach(() => {
		searchTokens.mockReset()
	})

	it('preserves token logos for search results', async () => {
		searchTokens.mockResolvedValue([
			{
				id: 'ethereum',
				searchId: 'coingecko:ethereum',
				coinKey: 'coingecko:ethereum',
				name: 'Ethereum',
				symbol: 'ETH',
				logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/ethereum',
				rank: 2
			}
		])

		await expect(fetchCoins('', 20)).resolves.toEqual([
			{
				id: 'coingecko:ethereum',
				name: 'Ethereum',
				logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/ethereum',
				type: 'Coin'
			}
		])
	})
})
