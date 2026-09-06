import { describe, expect, test } from 'vitest'
import { resolveProtocolCategory } from '../category'

describe('resolveProtocolCategory', () => {
	test('keeps the explicit protocol category when present', () => {
		expect(
			resolveProtocolCategory({
				protocolData: {
					id: 'parent#aave',
					category: 'Lending',
					isParentProtocol: true
				},
				liteProtocols: [
					{ parentProtocol: 'parent#aave', category: 'CDP', tvl: 100 },
					{ parentProtocol: 'parent#aave', category: 'Lending', tvl: 50 }
				]
			})
		).toBe('Lending')
	})

	test('uses the highest-tvl child category for parent protocols without a category', () => {
		expect(
			resolveProtocolCategory({
				protocolData: {
					id: 'parent#interface',
					category: '',
					isParentProtocol: true
				},
				liteProtocols: [
					{ parentProtocol: 'parent#interface', category: 'DEX Aggregator', tvl: 120 },
					{ parentProtocol: 'parent#interface', category: 'Perps', tvl: 340 },
					{ parentProtocol: 'parent#other', category: 'Lending', tvl: 999 }
				]
			})
		).toBe('Perps')
	})

	test('ignores child protocols without a category', () => {
		expect(
			resolveProtocolCategory({
				protocolData: {
					id: 'parent#interface',
					category: null,
					isParentProtocol: true
				},
				liteProtocols: [
					{ parentProtocol: 'parent#interface', category: '', tvl: 500 },
					{ parentProtocol: 'parent#interface', category: 'DEX Aggregator', tvl: 120 }
				]
			})
		).toBe('DEX Aggregator')
	})

	test('treats a nullable lite TVL as zero when ranking child categories', () => {
		expect(
			resolveProtocolCategory({
				protocolData: {
					id: 'parent#interface',
					category: null,
					isParentProtocol: true
				},
				liteProtocols: [
					{ parentProtocol: 'parent#interface', category: 'Unknown TVL', tvl: null },
					{ parentProtocol: 'parent#interface', category: 'Known TVL', tvl: 1 }
				]
			})
		).toBe('Known TVL')
	})

	test('returns null when no eligible child category exists', () => {
		expect(
			resolveProtocolCategory({
				protocolData: {
					id: 'parent#interface',
					category: null,
					isParentProtocol: true
				},
				liteProtocols: [{ parentProtocol: 'parent#interface', category: '', tvl: 120 }]
			})
		).toBeNull()
	})
})
