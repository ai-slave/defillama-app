import { describe, expect, it } from 'vitest'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { filterTokenYieldRows } from '../tokenYields.transform'

const row = (pool: string, chains: string[], tvl: number, apy: number): IYieldTableRow => ({
	pool,
	projectslug: 'aave-v3',
	project: 'Aave',
	chains,
	tvl,
	apy,
	apyBase: apy,
	apyReward: 0,
	rewardTokensSymbols: [],
	rewards: [],
	change1d: null,
	change7d: null,
	confidence: null,
	url: 'https://example.com',
	category: 'Lending',
	configID: pool
})

describe('filterTokenYieldRows', () => {
	it('filters by token, chain, positive TVL, and descending APY', () => {
		const rows = [
			row('ETH-USDC', ['Ethereum'], 100, 4),
			row('ETH-LINK', ['Ethereum'], 100, 7),
			row('ETH-ARB', ['Arbitrum'], 100, 9),
			row('ETH-ZERO', ['Ethereum'], 0, 10)
		]

		expect(filterTokenYieldRows(rows, 'ETH', 'Ethereum').map((entry) => entry.pool)).toEqual(['ETH-LINK', 'ETH-USDC'])
	})
})
