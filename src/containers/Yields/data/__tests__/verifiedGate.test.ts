import { describe, expect, test } from 'vitest'
import type { PoolDetail, PoolHistory } from '../../poolDetail/types'
import type { EarnPageRow, VerifiedBlock } from '../types'
import { lockEarnRow, lockEarnRows, lockPoolDetail, lockPoolHistory } from '../verifiedGate'

const VERIFIED = {
	apy: { avg_1d: 2.58, avg_7d: null, avg_30d: null },
	apy_as_of: '2026-08-29T00:00:00.000Z',
	apy_confidence: 'high',
	exit: { status: 'instant', eta_seconds: null, fee_bps: 0, as_of: '2026-08-28' },
	exit_liquidity: null,
	tvl: null,
	methods: ['balanceOf(holder) — position size']
} as unknown as VerifiedBlock

function row(over: Partial<EarnPageRow> = {}): EarnPageRow {
	return {
		apy: 3.03,
		apyBase: 2.58,
		apyReward: 0.45,
		verified: VERIFIED,
		verifiedApy: 2.58,
		reportedApyBase: 2.38,
		verifiedUnsubstitutedApy: 2.6,
		verifiedIntrinsicApy: 2.2,
		reportedIntrinsicApy: 2.29,
		exitStatus: 900,
		resolvedApy: { base: 2.58, reward: 0.45, intrinsic: null, total: 3.03 },
		...over
	} as EarnPageRow
}

describe('lockEarnRow', () => {
	test('leaves no measured field behind, in a shape getStaticProps can serialize', () => {
		const locked = lockEarnRow(row())

		expect(locked.verified).toBeNull()
		expect(locked.verifiedApy).toBeNull()
		expect(locked.reportedApyBase).toBeNull()
		expect(locked.verifiedUnsubstitutedApy).toBeNull()
		expect(locked.verifiedIntrinsicApy).toBeNull()
		expect(locked.reportedIntrinsicApy).toBeNull()
		// `undefined` would break the ISR page, which embeds these rows in its props.
		expect(JSON.parse(JSON.stringify(locked))).toMatchObject({ verified: null, verifiedApy: null })
	})

	// The pool being measured is the only thing worth selling, and it discloses no figure.
	test('keeps the fact that a measurement exists, and only that', () => {
		expect(lockEarnRow(row()).verifiedLocked).toBe(true)
		expect(
			lockEarnRow(row({ verified: null, verifiedApy: null, reportedApyBase: null })).verifiedLocked
		).toBeUndefined()
	})

	// exitStatus is derived from verified.exit; leaving it would let a locked reader rank pools by a
	// measurement they cannot see.
	test('drops the exit sort key so the Exit column cannot be ordered by a hidden measurement', () => {
		expect(lockEarnRow(row()).exitStatus).toBeNull()
	})

	// The APY figures need no repair: getEarnPage never applies the measured base for a locked
	// request, so what arrives here is already the protocol's own.
	test('passes the reported composition through untouched', () => {
		const locked = lockEarnRow(row({ apy: 2.83, apyBase: 2.38 }))
		expect(locked.apy).toBe(2.83)
		expect(locked.apyBase).toBe(2.38)
	})

	test('locks every row of a page', () => {
		expect(lockEarnRows([row(), row()]).every((r) => r.verified === null && r.verifiedLocked === true)).toBe(true)
	})
})

describe('lockPoolDetail', () => {
	// Detail is the only response that serves `verified.methods` — the exact on-chain calls.
	test('strips the block, methods included, and flags the pool as measured', () => {
		const locked = lockPoolDetail({ id: 'p', verified: VERIFIED } as unknown as PoolDetail)

		expect(locked.verified).toBeNull()
		expect(JSON.stringify(locked)).not.toContain('balanceOf')
		expect(locked.verified_locked).toBe(true)
	})

	test('makes no claim about a pool that was never measured', () => {
		expect(lockPoolDetail({ id: 'p', verified: null } as unknown as PoolDetail).verified_locked).toBe(false)
	})

	test('can preserve snapshot-known measurement membership without loading the detail sidecar', () => {
		expect(lockPoolDetail({ id: 'p', verified: null } as unknown as PoolDetail, true).verified_locked).toBe(true)
	})
})

describe('lockPoolHistory', () => {
	test('drops every measured day while keeping the reported series and its dates', () => {
		const history = [
			{ date: '2026-08-27', tvl_usd: 10, verified: { apy: { avg_1d: 5 } } },
			{ date: '2026-08-28', tvl_usd: 11, verified: null }
		] as unknown as PoolHistory

		const locked = lockPoolHistory(history)

		expect(locked.map((point) => point.date)).toEqual(['2026-08-27', '2026-08-28'])
		expect(locked.map((point) => point.tvl_usd)).toEqual([10, 11])
		expect(locked.every((point) => point.verified == null)).toBe(true)
	})
})
