import { describe, expect, test } from 'vitest'
import { foldRwaChainSeries, rankRwaChains } from '../chainFold'
import { spotAsset } from '../table/__tests__/fixtures'

const usdy = spotAsset()
const buidl = spotAsset({
	id: 'buidl',
	canonicalMarketId: 'securitize/buidl',
	ticker: 'BUIDL',
	activeMcap: {
		total: 500_000,
		breakdown: [
			['Ethereum', 100_000],
			['Avalanche', 400_000]
		]
	},
	onChainMcap: {
		total: 500_000,
		breakdown: [
			['Ethereum', 100_000],
			['Avalanche', 400_000]
		]
	},
	defiActiveTvlByChain: { total: 50_000, breakdown: [['Avalanche', 50_000]] }
})

describe('rankRwaChains', () => {
	test('ranks chains by the assets’ current value for the metric, largest first', () => {
		expect(rankRwaChains([usdy, buidl], 'activeMcap')).toEqual(['Ethereum', 'Avalanche', 'Solana'])
		expect(rankRwaChains([usdy, buidl], 'onChainMcap')).toEqual(['Ethereum', 'Avalanche', 'Solana', 'Mantle'])
		expect(rankRwaChains([usdy, buidl], 'defiActiveTvl')).toEqual(['Ethereum', 'Avalanche'])
	})

	test('caps the list and breaks ties by name', () => {
		expect(rankRwaChains([usdy, buidl], 'activeMcap', 2)).toEqual(['Ethereum', 'Avalanche'])
		const tied = spotAsset({
			canonicalMarketId: 'x/tied',
			activeMcap: {
				total: 2,
				breakdown: [
					['Zeta', 1],
					['Alpha', 1]
				]
			}
		})
		expect(rankRwaChains([tied], 'activeMcap')).toEqual(['Alpha', 'Zeta'])
	})

	test('ignores perps rows and assets without a breakdown', () => {
		expect(rankRwaChains([spotAsset({ activeMcap: null })], 'activeMcap')).toEqual([])
	})
})

describe('foldRwaChainSeries', () => {
	const total = {
		dimensions: ['timestamp', 'Total Active AUM'] as ['timestamp', ...Array<string>],
		source: [
			[1, 1000],
			[2, null],
			[3, 1200]
		] as Array<[number, ...Array<number | null | undefined>]>
	}

	test('draws one series per chain over the page’s assets, the Total first and Others as the remainder', () => {
		const folded = foldRwaChainSeries({
			chains: [
				{
					chain: 'Ethereum',
					rows: [
						{ timestamp: 1, 'ondo/usdy': 600, 'securitize/buidl': 100, 'other/asset': 999 },
						{ timestamp: 2, 'ondo/usdy': 600 },
						{ timestamp: 3, 'ondo/usdy': 650, 'securitize/buidl': 100 }
					]
				},
				{
					chain: 'Avalanche',
					rows: [
						{ timestamp: 1, 'securitize/buidl': 200 },
						{ timestamp: 3, 'securitize/buidl': 300 }
					]
				}
			],
			assets: [usdy, buidl],
			total
		})
		expect(folded.dimensions).toEqual(['timestamp', 'Total Active AUM', 'Ethereum', 'Avalanche', 'Others'])
		expect(folded.source).toEqual([
			[1, 1000, 700, 200, 100],
			[2, null, 600, null, null],
			[3, 1200, 750, 300, 150]
		])
	})

	test('floors Others at zero and drops it when every row is zero', () => {
		const folded = foldRwaChainSeries({
			chains: [
				{
					chain: 'Ethereum',
					rows: [
						{ timestamp: 1, 'ondo/usdy': 1000 },
						{ timestamp: 3, 'ondo/usdy': 1300 }
					]
				}
			],
			assets: [usdy],
			total
		})
		expect(folded.dimensions).toEqual(['timestamp', 'Total Active AUM', 'Ethereum'])
		expect(folded.source).toEqual([
			[1, 1000, 1000],
			[2, null, null],
			[3, 1200, 1300]
		])
	})

	test('returns the total alone when there is no chain', () => {
		expect(foldRwaChainSeries({ chains: [], assets: [usdy], total })).toEqual(total)
	})

	test('returns an empty dataset when the total is empty', () => {
		const empty = { dimensions: ['timestamp'] as ['timestamp'], source: [] }
		expect(foldRwaChainSeries({ chains: [], assets: [usdy], total: empty })).toEqual(empty)
	})
})
