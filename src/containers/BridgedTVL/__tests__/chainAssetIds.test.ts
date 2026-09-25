import { describe, expect, test } from 'vitest'
import { buildChainAssetIdIndex } from '../chainAssetIds'

describe('buildChainAssetIdIndex', () => {
	test('indexes metadata keys, producer IDs, display names, and saved aliases', () => {
		const index = buildChainAssetIdIndex({
			'hyperliquid-l1': { id: 'hyperliquid', name: 'Hyperliquid L1', chainAssets: true },
			'op-mainnet': { id: 'optimism', name: 'OP Mainnet', chainAssets: true },
			avalanche: { id: 'avax', name: 'Avalanche', chainAssets: true },
			gnosis: { id: 'xdai', name: 'Gnosis', chainAssets: true },
			'zksync-era': { id: 'era', name: 'ZKsync Era', chainAssets: true }
		})

		expect(index.get('hyperliquid-l1')).toBe('hyperliquid')
		expect(index.get('hyperliquid')).toBe('hyperliquid')
		expect(index.get('optimism')).toBe('optimism')
		expect(index.get('avax')).toBe('avax')
		expect(index.get('xdai')).toBe('xdai')
		expect(index.get('zksync')).toBe('era')
	})

	test('does not expose chains without the chain-assets capability', () => {
		const index = buildChainAssetIdIndex({
			ethereum: { id: 'ethereum', name: 'Ethereum' }
		})

		expect(index.has('ethereum')).toBe(false)
	})
})
