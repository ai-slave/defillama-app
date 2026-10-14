import { describe, expect, test } from 'vitest'
import { buildProtocolFaq, buildProtocolFaqRelationship, type ProtocolFaqContext } from '../faq'

function createContext(overrides: Partial<ProtocolFaqContext> = {}): ProtocolFaqContext {
	return {
		name: 'Aave',
		tvl: { current: 25_140_000_000, change30d: 3 },
		chains: [
			{ name: 'Ethereum', tvl: 20_600_000_000, href: '/chain/ethereum' },
			{ name: 'Base', tvl: 1_500_000_000, href: '/chain/base' }
		],
		fees: {
			fees30d: 42_100_000,
			revenue30d: 11_800_000,
			annualizedFees: 505_000_000,
			annualizedRevenue: 140_000_000
		},
		token: {
			symbol: 'AAVE',
			marketCapRank: 38,
			currentPrice: 214.4,
			priceChange7d: 8.4,
			priceChange30d: 3.1,
			marketCap: 3_240_000_000,
			fdv: 3_430_000_000,
			circulatingSupply: 15_100_000,
			totalSupply: 16_000_000,
			maxSupply: 16_000_000,
			ath: 666.86,
			athDate: '2021-05-18T00:00:00Z',
			tokenPageRoute: '/token/AAVE'
		},
		comparison: {
			category: 'Lending',
			categoryHref: '/protocols/lending',
			rank: 1,
			protocolCount: 189,
			totalTvl: 53_500_000_000,
			sharePercent: 36.8,
			peers: [
				{ name: 'Compound', href: '/protocol/compound', tvl: 10_000_000_000 },
				{ name: 'Morpho', href: '/protocol/morpho', tvl: 8_000_000_000 },
				{ name: 'Spark', href: '/protocol/spark', tvl: 5_000_000_000 }
			]
		},
		children: [],
		useChildrenQuestion: false,
		treasury: {
			ownTokens: 40_000_000,
			stablecoins: 30_000_000,
			majors: 20_000_000,
			others: 8_200_000,
			total: 98_200_000
		},
		hacks: [
			{
				date: 1_669_075_200,
				amountUsd: 1_600_000,
				classification: 'Governance Manipulation'
			}
		],
		metrics: {
			borrowed: 18_000_000_000,
			dexVolume30d: null,
			perpVolume30d: null,
			openInterest: null,
			yieldPoolCount: null,
			averageApy: null
		},
		description: null,
		volumeLeads: false,
		...overrides
	}
}

describe('buildProtocolFaq', () => {
	test('builds the ordered maximum set with crawlable internal-link parts', () => {
		const items = buildProtocolFaq(createContext())

		expect(items.map((item) => item.id)).toEqual([
			'tvl',
			'fees-revenue',
			'active-loans',
			'comparison',
			'chains',
			'token-valuation',
			'token-performance',
			'treasury',
			'security'
		])
		expect(items).toHaveLength(9)
		expect(items.flatMap((item) => item.answer).filter((part) => part.href)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ text: 'Ethereum', href: '/chain/ethereum' }),
				expect.objectContaining({ text: 'AAVE', href: '/token/AAVE' }),
				expect.objectContaining({
					text: 'Compound',
					href: '/protocol/compound'
				})
			])
		)
	})

	test('omits unavailable questions instead of filling to ten', () => {
		const items = buildProtocolFaq(
			createContext({
				tvl: { current: null, change30d: null },
				fees: {
					fees30d: null,
					revenue30d: null,
					annualizedFees: null,
					annualizedRevenue: null
				},
				token: null,
				comparison: null,
				treasury: null,
				hacks: [],
				metrics: {
					borrowed: null,
					dexVolume30d: null,
					perpVolume30d: null,
					openInterest: null,
					yieldPoolCount: null,
					averageApy: null
				}
			})
		)

		expect(items.map((item) => item.id)).toEqual(['chains'])
	})

	test('asks what the protocol is first, and opens volume next when volume leads the title', () => {
		const described = buildProtocolFaq(
			createContext({
				description: 'Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets'
			})
		)
		expect(described[0]).toMatchObject({
			id: 'what-is',
			question: 'What is Aave?',
			answer: [
				{
					text: 'Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets'
				}
			]
		})

		const volumeLed = buildProtocolFaq(
			createContext({
				name: 'Variational',
				description: 'Variational is a protocol that provides infrastructure for peer-to-peer trading.',
				tvl: { current: null, change30d: null },
				fees: { fees30d: null, revenue30d: null, annualizedFees: null, annualizedRevenue: null },
				volumeLeads: true,
				metrics: {
					borrowed: null,
					dexVolume30d: null,
					perpVolume30d: 4_200_000_000,
					openInterest: null,
					yieldPoolCount: null,
					averageApy: null
				}
			})
		)
		expect(volumeLed.map((item) => item.id).slice(0, 2)).toEqual(['what-is', 'perp-volume'])
	})
})

describe('buildProtocolFaqRelationship', () => {
	test("aggregates the current parent's same-category children for comparisons", () => {
		const relationship = buildProtocolFaqRelationship({
			protocolId: 'parent#aave',
			protocolName: 'Aave',
			category: 'Lending',
			isParent: true,
			chains: ['Ethereum'],
			protocols: [
				{
					name: 'Aave V2',
					defillamaId: '111',
					category: 'Lending',
					chains: ['Ethereum'],
					tvl: 4,
					parentProtocol: 'parent#aave'
				},
				{
					name: 'Aave V3',
					defillamaId: '1599',
					category: 'Lending',
					chains: ['Ethereum'],
					tvl: 6,
					parentProtocol: 'parent#aave'
				},
				{
					name: 'Incomplete row',
					defillamaId: 'missing-category',
					chains: [],
					tvl: 100
				},
				{
					name: 'Compound V3',
					defillamaId: '2000',
					category: 'Lending',
					chains: ['Ethereum'],
					tvl: 5,
					parentProtocol: 'parent#compound'
				}
			]
		})

		expect(relationship.useChildrenQuestion).toBe(false)
		expect(relationship.comparison).toMatchObject({
			rank: 1,
			protocolCount: 2,
			totalTvl: 15
		})
		expect(relationship.comparison?.peers).toEqual([{ name: 'Compound V3', href: '/protocol/compound-v3', tvl: 5 }])
	})

	test('uses the children question for a parent spanning multiple categories', () => {
		const relationship = buildProtocolFaqRelationship({
			protocolId: 'parent#example',
			protocolName: 'Example',
			category: 'Lending',
			isParent: true,
			chains: ['Ethereum'],
			protocols: [
				{
					name: 'Example Lend',
					defillamaId: '1',
					category: 'Lending',
					chains: ['Ethereum'],
					tvl: 10,
					parentProtocol: 'parent#example'
				},
				{
					name: 'Example DEX',
					defillamaId: '2',
					category: 'Dexes',
					chains: ['Ethereum'],
					tvl: 5,
					parentProtocol: 'parent#example'
				}
			]
		})

		expect(relationship.comparison).toBeNull()
		expect(relationship.useChildrenQuestion).toBe(true)
		expect(relationship.children.map((child) => child.name)).toEqual(['Example Lend', 'Example DEX'])
	})

	test('prioritizes same-chain products before cross-chain products', () => {
		const relationship = buildProtocolFaqRelationship({
			protocolId: 'boros',
			protocolName: 'Boros',
			category: 'Interest Rate Derivatives',
			isParent: false,
			chains: ['Arbitrum'],
			protocols: [
				{
					name: 'Boros',
					defillamaId: 'boros',
					category: 'Interest Rate Derivatives',
					chains: ['Arbitrum'],
					tvl: 8
				},
				{
					name: 'Rho X',
					defillamaId: 'rho-x',
					category: 'Interest Rate Derivatives',
					chains: ['Ethereum'],
					tvl: 10,
					parentProtocol: 'parent#rho'
				},
				{
					name: 'Arbitrum Rates',
					defillamaId: 'arbitrum-rates',
					category: 'Interest Rate Derivatives',
					chains: ['Arbitrum'],
					tvl: 1
				}
			]
		})

		expect(relationship.comparison?.peers.map((peer) => peer.name)).toEqual(['Arbitrum Rates', 'Rho X'])
	})
})
