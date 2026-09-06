import { describe, expect, test } from 'vitest'
import { findBlockExplorerChain, getBlockExplorerNew } from '../blockExplorers'

const blockExplorers = [
	{
		displayName: 'Arbitrum',
		llamaChainId: 'arbitrum',
		evmChainId: 42_161,
		blockExplorers: [{ name: 'Arbiscan', url: 'https://arbiscan.io' }]
	},
	{
		displayName: 'Ethereum',
		llamaChainId: 'ethereum',
		evmChainId: 1,
		blockExplorers: [{ name: 'Etherscan', url: 'https://etherscan.io' }]
	}
]

describe('findBlockExplorerChain', () => {
	test('prefers llama chain id matches before falling back to display name', () => {
		expect(
			findBlockExplorerChain(blockExplorers, { chainId: 'arbitrum', chainName: 'Arbitrum One' })?.llamaChainId
		).toBe('arbitrum')
	})

	test('falls back to the display name when no chain id match exists', () => {
		expect(findBlockExplorerChain(blockExplorers, { chainName: 'Ethereum' })?.llamaChainId).toBe('ethereum')
	})

	test('normalizes whitespace and underscores in chain identifiers', () => {
		expect(
			findBlockExplorerChain(blockExplorers, { chainId: 'arbitrum', chainName: 'Arbitrum_One' })?.llamaChainId
		).toBe('arbitrum')
	})
})

describe('getBlockExplorerNew', () => {
	test('builds an address url from explicit chain context', () => {
		expect(
			getBlockExplorerNew({
				apiResponse: blockExplorers,
				address: '0xabc',
				chainId: 'arbitrum',
				chainName: 'Arbitrum One',
				urlType: 'address'
			})
		).toEqual({
			chainDisplayName: 'Arbitrum',
			name: 'Arbiscan',
			url: 'https://arbiscan.io/address/0xabc'
		})
	})
})
