import { describe, expect, test } from 'vitest'
import type { Chain, Protocol } from '../types'
import {
	buildQuickAddIndex,
	findQuickAddEntity,
	quickAddEntityKey,
	searchQuickAddEntities,
	topQuickAddEntities
} from './quickAddIndex'

function createProtocol(protocol: Partial<Protocol> & Pick<Protocol, 'name' | 'slug'>): Protocol {
	return {
		id: protocol.slug,
		tvl: 0,
		chains: [],
		...protocol
	}
}

function createChain(chain: Partial<Chain> & Pick<Chain, 'name'>): Chain {
	return {
		gecko_id: null,
		tvl: 0,
		tokenSymbol: null,
		chainId: null,
		cmcId: null,
		...chain
	}
}

const chains: Array<Chain> = [
	createChain({ name: 'Ethereum', tvl: 60_000_000_000, gecko_id: 'ethereum', tokenSymbol: 'ETH' }),
	createChain({ name: 'Solana', tvl: 9_000_000_000, gecko_id: 'solana', tokenSymbol: 'SOL' })
]

const protocols: Array<Protocol> = [
	createProtocol({ name: 'Uniswap', slug: 'uniswap', tvl: 5_000_000_000, symbol: 'UNI', geckoId: 'uniswap' }),
	createProtocol({
		name: 'Uniswap V3',
		slug: 'uniswap-v3',
		tvl: 40_000_000_000,
		parentProtocol: 'parent#uniswap',
		symbol: '-'
	}),
	createProtocol({ name: 'Aave', slug: 'aave', tvl: 20_000_000_000, symbol: 'AAVE' })
]

const parentMapping = new Map<string, ReadonlyArray<string>>([['uniswap', ['uniswap-v3']]])

describe('quick add entity index', () => {
	test('ranks chains and protocols by tvl and keeps parents above their children', () => {
		const index = buildQuickAddIndex({ protocols, chains, parentMapping })
		expect(index.map((entity) => entity.key)).toEqual([
			quickAddEntityKey('chain', 'Ethereum'),
			quickAddEntityKey('protocol', 'aave'),
			quickAddEntityKey('chain', 'Solana'),
			quickAddEntityKey('protocol', 'uniswap'),
			quickAddEntityKey('protocol', 'uniswap-v3')
		])
		const child = index.find((entity) => entity.id === 'uniswap-v3')
		const parent = index.find((entity) => entity.id === 'uniswap')
		expect(parent?.rank).toBeGreaterThan(child?.rank ?? 0)
	})

	test('falls back to parentProtocol when no parent mapping is given', () => {
		const index = buildQuickAddIndex({ protocols, chains: [] })
		expect(index[index.length - 1]?.id).toBe('uniswap-v3')
	})

	test('indexes symbols and spaceless names as aliases', () => {
		const index = buildQuickAddIndex({ protocols, chains, parentMapping })
		const ethereum = findQuickAddEntity(index, 'chain', 'Ethereum')
		expect(ethereum?.aliases).toContain('ETH')
		expect(findQuickAddEntity(index, 'protocol', 'uniswap')?.aliases).toContain('UNI')
		expect(findQuickAddEntity(index, 'protocol', 'uniswap-v3')?.aliases).not.toContain('-')
	})

	test('searches by name, symbol and slug with the parent ranked first', () => {
		const index = buildQuickAddIndex({ protocols, chains, parentMapping })
		expect(searchQuickAddEntities(index, ['uni']).map((entity) => entity.id)).toEqual(['uniswap', 'uniswap-v3'])
		expect(searchQuickAddEntities(index, ['eth'])[0]?.id).toBe('Ethereum')
		expect(searchQuickAddEntities(index, ['aave'])[0]?.id).toBe('aave')
		expect(searchQuickAddEntities(index, [])).toEqual([])
	})

	test('caps the number of matched entities', () => {
		const manyProtocols: Array<Protocol> = []
		for (let position = 0; position < 20; position++) {
			manyProtocols.push(createProtocol({ name: `Pool ${position}`, slug: `pool-${position}`, tvl: position }))
		}
		const index = buildQuickAddIndex({ protocols: manyProtocols, chains: [] })
		expect(searchQuickAddEntities(index, ['pool'])).toHaveLength(6)
		expect(searchQuickAddEntities(index, ['pool'], 2)).toHaveLength(2)
	})

	test('lists the highest ranked entities', () => {
		const index = buildQuickAddIndex({ protocols, chains, parentMapping })
		expect(topQuickAddEntities(index, 2).map((entity) => entity.id)).toEqual(['Ethereum', 'aave'])
	})
})
