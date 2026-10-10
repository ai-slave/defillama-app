import { describe, expect, test } from 'vitest'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { earnPageRow } from '~/utils/testing/yieldsEarnFixture'
import {
	filterTokenYieldPools,
	formatTokenYieldsSummary,
	hasActiveTokenYieldsFilters
} from '../TokenYieldsSection.utils'

function pool(id: string, chain: string, tvl: number | null, apy: number | null) {
	return earnPageRow(id, { chains: [chain], tvl, apy })
}

const POOLS = [
	pool('eth-big', 'Ethereum', 2_000_000, 8),
	pool('eth-small', 'Ethereum', 1000, 2),
	pool('base', 'Base', 50_000, null)
]
const NO_FILTERS = {
	chainCount: 2,
	selectedChains: ['Ethereum', 'Base'],
	minTvl: null,
	maxTvl: null,
	minApy: null,
	maxApy: null
}
const ids = (rows: Array<IYieldTableRow>) => rows.map((row) => row.id)

describe('token yields filters', () => {
	test('offers Reset filters only for real filter params, not column visibility', () => {
		expect(hasActiveTokenYieldsFilters({ showMedianApy: 'true' })).toBe(false)
		expect(hasActiveTokenYieldsFilters({ minApy: '4' })).toBe(true)
		expect(hasActiveTokenYieldsFilters({ chain: [] })).toBe(false)
		expect(hasActiveTokenYieldsFilters({ chain: ['Ethereum'] })).toBe(true)
	})

	test('treats every chain selected as no chain filter', () => {
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, selectedChains: ['Base'] }).pools)).toEqual([
			'base'
		])
		expect(
			ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, selectedChains: ['Base', 'Ethereum'] }).pools)
		).toEqual(['eth-big', 'eth-small', 'base'])
		// A pool whose chain is missing from the chain list still shows while every listed chain is selected.
		const unlisted = [...POOLS, pool('arbitrum', 'Arbitrum', 10, 1)]
		expect(
			ids(filterTokenYieldPools({ pools: unlisted, ...NO_FILTERS, selectedChains: ['Base', 'Ethereum'] }).pools)
		).toEqual(['eth-big', 'eth-small', 'base', 'arbitrum'])
	})

	test('shows no pools after Deselect All', () => {
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, selectedChains: [] }).pools)).toEqual([])
	})

	test('drops pools without a TVL or APY once that bound is set', () => {
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, minTvl: 10_000, maxTvl: 100_000 }).pools)).toEqual([
			'base'
		])
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, minApy: 1 }).pools)).toEqual([
			'eth-big',
			'eth-small'
		])
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, minTvl: 5_000_000 }).pools)).toEqual([])
	})
})

describe('token yields range chips', () => {
	test('count each range over the pools every other filter keeps', () => {
		const pools = [
			pool('a', 'Ethereum', 2_000_000, 30),
			pool('b', 'Ethereum', 1_500_000, 25),
			pool('c', 'Ethereum', 1_200_000, 22),
			pool('d', 'Base', 300_000, 6),
			pool('e', 'Base', 200_000, 7),
			pool('f', 'Base', 50_000, 1)
		]
		expect(filterTokenYieldPools({ pools, ...NO_FILTERS })).toMatchObject({
			tvlQuickPicks: [100_000, 1_000_000],
			apyQuickPicks: [5, 10, 20]
		})
		expect(filterTokenYieldPools({ pools, ...NO_FILTERS, minTvl: 1_000_000 })).toMatchObject({
			tvlQuickPicks: [100_000, 1_000_000],
			apyQuickPicks: []
		})
	})
})

describe('token yields summary', () => {
	test('reports the pool count with its average APY', () => {
		expect(
			formatTokenYieldsSummary({ stats: { noOfPoolsTracked: 1, averageAPY: 5.1 }, totalRowCount: 1, isPartial: false })
		).toBe('Tracking 1 pool, average APY 5.10%')
		expect(
			formatTokenYieldsSummary({ stats: { noOfPoolsTracked: 2, averageAPY: null }, totalRowCount: 2, isPartial: false })
		).toBe('Tracking 2 pools')
	})

	test('counts only loaded pools until the full dataset arrives', () => {
		expect(
			formatTokenYieldsSummary({ stats: { noOfPoolsTracked: 1, averageAPY: 5.1 }, totalRowCount: 25, isPartial: true })
		).toBe('Showing 1 of 25 pools')
		expect(
			formatTokenYieldsSummary({ stats: { noOfPoolsTracked: 0, averageAPY: null }, totalRowCount: 25, isPartial: true })
		).toBeNull()
	})
})
