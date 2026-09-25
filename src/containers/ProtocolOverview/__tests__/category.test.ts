import { describe, expect, test } from 'vitest'
import { getProtocolInfoCategories, resolveProtocolCategory } from '../category'

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
		expect(
			resolveProtocolCategory({
				protocolData: { id: 'parent#interface', category: null, isParentProtocol: true },
				liteProtocols: [{ parentProtocol: 'parent#interface', category: '', tvl: 500 }]
			})
		).toBeNull()
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
})

describe('getProtocolInfoCategories', () => {
	test('links the own category first, then each new child category, with routes outside /protocols, and uses child categories alone when the protocol has none', () => {
		expect(
			getProtocolInfoCategories('Interest Rate Derivatives', [
				{ category: 'Interest Rate Derivatives' },
				{ category: 'Yield' },
				{ category: null },
				{ category: 'Dexs' },
				{ category: 'Yield' }
			])
		).toEqual([
			{ label: 'Interest Rate Derivatives', href: '/protocols/interest-rate-derivatives' },
			{ label: 'Yield', href: '/protocols/yield' },
			{ label: 'Dexs', href: '/dexs' }
		])
		expect(getProtocolInfoCategories(null, [{ category: 'Prediction Market' }])).toEqual([
			{ label: 'Prediction Market', href: '/protocols/prediction-market' }
		])
	})
})
