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
const NO_FILTERS = { chainCount: 2, selectedChains: [], minTvl: null, maxTvl: null, minApy: null, maxApy: null }
const ids = (rows: Array<IYieldTableRow>) => rows.map((row) => row.id)

describe('token yields filters', () => {
	test('offers Reset filters only for real filter params, not column visibility', () => {
		expect(hasActiveTokenYieldsFilters({ showMedianApy: 'true' })).toBe(false)
		expect(hasActiveTokenYieldsFilters({ minApy: '4' })).toBe(true)
		expect(hasActiveTokenYieldsFilters({ chain: [] })).toBe(false)
		expect(hasActiveTokenYieldsFilters({ chain: ['Ethereum'] })).toBe(true)
	})

	test('treats every chain selected as no chain filter', () => {
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, selectedChains: ['Base'] }))).toEqual(['base'])
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, selectedChains: ['Base', 'Ethereum'] }))).toEqual([
			'eth-big',
			'eth-small',
			'base'
		])
		// A pool whose chain is missing from the chain list still shows while every listed chain is selected.
		const unlisted = [...POOLS, pool('arbitrum', 'Arbitrum', 10, 1)]
		expect(
			ids(filterTokenYieldPools({ pools: unlisted, ...NO_FILTERS, selectedChains: ['Base', 'Ethereum'] }))
		).toEqual(['eth-big', 'eth-small', 'base', 'arbitrum'])
	})

	test('drops pools without a TVL or APY once that bound is set', () => {
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, minTvl: 10_000, maxTvl: 100_000 }))).toEqual([
			'base'
		])
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, minApy: 1 }))).toEqual(['eth-big', 'eth-small'])
		expect(ids(filterTokenYieldPools({ pools: POOLS, ...NO_FILTERS, minTvl: 5_000_000 }))).toEqual([])
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
