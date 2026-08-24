import { describe, expect, it } from 'vitest'
import { prepareYieldPoolsCsv } from '../domain/poolCsv'
import type { YieldPoolTableRow } from '../Tables/types'

const row = (overrides: Partial<YieldPoolTableRow> = {}): YieldPoolTableRow =>
	({
		pool: 'stETH',
		project: 'Lido',
		chains: ['Ethereum'],
		referenceAsset: 'ETH',
		category: 'Liquid Staking',
		tvl: 16_000_000_000,
		apy: 2.24,
		apyBase: 2.24,
		apyReward: null,
		holderCount: 615_498,
		poolMeta: null,
		...overrides
	}) as YieldPoolTableRow

describe('prepareYieldPoolsCsv', () => {
	it('default view mirrors the earn table with base+reward split', () => {
		const csv = prepareYieldPoolsCsv([row()])
		expect(csv.filename).toBe('yield-pools.csv')
		expect(csv.rows[0]).toEqual([
			'Pool',
			'Reference',
			'Protocol',
			'Chain',
			'APY Base',
			'APY Reward',
			'APY',
			'30d Stability Rating',
			'30d Stability Score',
			'TVL',
			'Holders',
			'Pool Meta'
		])
		expect(csv.rows[1]?.[0]).toBe('stETH')
		expect(csv.rows[1]?.[2]).toBe('Lido')
	})

	it('base-only view collapses to a single APY column', () => {
		const csv = prepareYieldPoolsCsv([], { apyComponents: 'base' })
		expect(csv.rows[0]).toContain('APY')
		expect(csv.rows[0]).not.toContain('APY Base')
	})

	it('non-Now window suffixes APY headers', () => {
		const csv = prepareYieldPoolsCsv([], { apyWindow: 'avg_30d', apyComponents: 'base' })
		expect(csv.rows[0]).toContain('APY (30d)')
	})

	it('optional columns export only when selected', () => {
		const without = prepareYieldPoolsCsv([], {})
		expect(without.rows[0]).not.toContain('1d Volume')
		const withCols = prepareYieldPoolsCsv([], { column: ['volumeUsd1d', 'top10Pct'] })
		expect(withCols.rows[0]).toContain('1d Volume')
		expect(withCols.rows[0]).toContain('Holders: Top 10 %')
		expect(withCols.rows[0]).not.toContain('Holders: Avg Position')
	})
})
