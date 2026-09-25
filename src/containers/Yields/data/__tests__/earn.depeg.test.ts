import { describe, expect, test } from 'vitest'
import { installYieldsFixtures } from '~/utils/testing/yieldsSnapshotFixture'
import { getDepegWarningSeverity } from '../../domain/apyPresentation'
import { earnPage, pool } from './earnSnapshot'

installYieldsFixtures()

describe('getEarnPage depeg stamping', () => {
	test('stamps pegDeviation (relative) + pegTokenSymbol onto matching pools, leaves others absent', async () => {
		const result = await earnPage(
			{ earn: [pool('a'), pool('b')], depegs: [{ pool_id: 'a', deviation_pct: -0.0723, token_symbol: 'deUSD' }] },
			{ pageSize: 'all' }
		)
		const byId = new Map(result.rows.map((r) => [r.id, r]))

		expect(byId.get('a')?.pegDeviation).toBe(-0.0723)
		expect(byId.get('a')?.pegTokenSymbol).toBe('deUSD')
		expect(byId.get('b')?.pegDeviation).toBeUndefined()
		expect(byId.get('b')?.pegTokenSymbol).toBeUndefined()
	})

	test('stamps exploited onto pools flagged by /v2/exploits, leaves others absent', async () => {
		const result = await earnPage({ earn: [pool('a'), pool('b')], exploits: ['b'] }, { pageSize: 'all' })
		const byId = new Map(result.rows.map((r) => [r.id, r]))

		expect(byId.get('b')?.exploited).toBe(true)
		expect(byId.get('a')?.exploited).toBeUndefined()
	})
})

describe('depeg warning severity', () => {
	test('returns no warning below the 5% threshold', () => {
		expect(getDepegWarningSeverity(0.0499)).toBeNull()
	})

	test('returns warning severity from 5% up to 10%', () => {
		expect(getDepegWarningSeverity(-0.05)).toBe('warning')
		expect(getDepegWarningSeverity(0.0999)).toBe('warning')
	})

	test('returns danger severity at 10% in either direction', () => {
		expect(getDepegWarningSeverity(0.1)).toBe('danger')
		expect(getDepegWarningSeverity(-0.1)).toBe('danger')
	})
})
