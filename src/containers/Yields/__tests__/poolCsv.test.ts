import { describe, expect, test } from 'vitest'
import { prepareYieldPoolsCsv } from '../domain/poolCsv'
import { EARN_NO_COLUMNS, PAID_DEFAULT_EARN_COLUMNS } from '../Filters/columnOptions'
import type { IYieldTableRow } from '../Tables/types'

const row = (overrides: Partial<IYieldTableRow> = {}): IYieldTableRow =>
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
	}) as IYieldTableRow

describe('prepareYieldPoolsCsv', () => {
	test('default view mirrors the earn table with base+reward split', () => {
		const csv = prepareYieldPoolsCsv([
			row({ apyBase: 2, apyReward: 0.24, stabilityRating: 'stable', stabilityScore: 91, poolMeta: 'Staked' })
		])
		expect(csv.rows[0]).toEqual([
			'Pool',
			'Reference',
			'Protocol',
			'Chain',
			'APY Base (30d)',
			'APY Reward (30d)',
			'APY (30d)',
			'30d Stability Rating',
			'30d Stability Score',
			'TVL',
			'Holders',
			'Pool Meta'
		])
		expect(csv.rows[1]).toEqual([
			'stETH',
			'ETH',
			'Lido',
			'Ethereum',
			2,
			0.24,
			2.24,
			'stable',
			91,
			16_000_000_000,
			615_498,
			'Staked'
		])
	})

	test('base-only view collapses to a single APY column', () => {
		const csv = prepareYieldPoolsCsv([], { apyComponents: 'base' })
		expect(csv.rows[0]).toContain('APY (30d)')
		expect(csv.rows[0]).not.toContain('APY Base (30d)')
	})

	test('non-Latest window suffixes APY headers', () => {
		const csv = prepareYieldPoolsCsv([], { apyWindow: 'avg_7d', apyComponents: 'base' })
		expect(csv.rows[0]).toContain('APY (7d)')
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
