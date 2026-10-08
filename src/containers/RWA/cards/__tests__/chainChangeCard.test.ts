import { describe, expect, test } from 'vitest'
import { spotAsset } from '../../table/__tests__/fixtures'
import { foldRwaChainChangeCard, foldRwaChainHistories } from '../chainChangeCard'

const DAY = 24 * 60 * 60 * 1000

describe('foldRwaChainHistories', () => {
	test("sums each chain's history over the page's assets only, one column per chain", () => {
		const usdy = spotAsset()
		const rows = foldRwaChainHistories(
			[
				{
					chain: 'Ethereum',
					rows: [
						{ timestamp: 0, [usdy.canonicalMarketId]: 10, other: 99 },
						{ timestamp: DAY, [usdy.canonicalMarketId]: 12 }
					]
				},
				{ chain: 'Solana', rows: [{ timestamp: DAY, [usdy.canonicalMarketId]: 3 }] }
			],
			[usdy]
		)
		expect(rows).toEqual([
			{ timestamp: 0, Ethereum: 10 },
			{ timestamp: DAY, Ethereum: 12, Solana: 3 }
		])
	})
})

describe('foldRwaChainChangeCard', () => {
	test("reads the page's active AUM and its 30d change beside the bars", () => {
		const card = foldRwaChainChangeCard([spotAsset()], [{ name: 'Ethereum', changeUsd: 5, changePct: 1 }])
		expect(card).toEqual({
			changeUsd: 300_000,
			changePct: 60,
			bars: [{ name: 'Ethereum', changeUsd: 5, changePct: 1 }]
		})
	})
})
