import { describe, expect, test } from 'vitest'
import { prepareYieldPoolsCsv } from '../domain/poolCsv'
import { EARN_NO_COLUMNS, PAID_DEFAULT_EARN_COLUMNS } from '../Filters/columnOptions'
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
	test('default view mirrors the earn table with base+reward split', () => {
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

	test('base-only view collapses to a single APY column', () => {
		const csv = prepareYieldPoolsCsv([], { apyComponents: 'base' })
		expect(csv.rows[0]).toContain('APY')
		expect(csv.rows[0]).not.toContain('APY Base')
	})

	test('non-Now window suffixes APY headers', () => {
		const csv = prepareYieldPoolsCsv([], { apyWindow: 'avg_30d', apyComponents: 'base' })
		expect(csv.rows[0]).toContain('APY (30d)')
	})

	test('optional columns export only when selected', () => {
		const without = prepareYieldPoolsCsv([], {})
		expect(without.rows[0]).not.toContain('1d Volume')
		const withCols = prepareYieldPoolsCsv([], { column: ['volumeUsd1d', 'top10Pct'] })
		expect(withCols.rows[0]).toContain('1d Volume')
		expect(withCols.rows[0]).toContain('Holders: Top 10 %')
		expect(withCols.rows[0]).not.toContain('Holders: Avg Position')
	})

	test('exports the paid Exit default and honors an explicit clear', () => {
		const measured = row({
			verified: {
				apy: { avg_1d: 2.24, avg_7d: null, avg_30d: null },
				apy_as_of: '2026-09-04T00:00:00.000Z',
				apy_confidence: 'high',
				exit: {
					status: 'instant',
					eta_seconds: null,
					fee_bps: 0,
					as_of: '2026-09-04T00:00:00.000Z'
				},
				exit_liquidity: { amount: '1', usd: 1_000_000, slippage_bps: 0, as_of: '2026-09-04' },
				tvl: { amount: '1', usd: 1_000_000, as_of: '2026-09-04' }
			}
		})

		const defaults = prepareYieldPoolsCsv([measured], {}, PAID_DEFAULT_EARN_COLUMNS)
		const exitIndex = defaults.rows[0]!.indexOf('Exit Status')
		expect(exitIndex).toBeGreaterThan(-1)
		expect(defaults.rows[1]?.[exitIndex]).toBe('Instant exit')

		const cleared = prepareYieldPoolsCsv([measured], { column: EARN_NO_COLUMNS }, PAID_DEFAULT_EARN_COLUMNS)
		expect(cleared.rows[0]).not.toContain('Exit Status')
	})
})
