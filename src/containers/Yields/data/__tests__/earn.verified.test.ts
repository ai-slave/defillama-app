import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'
import { getEarnPage as getEarnPageFromSnapshot } from '../earn.server'
import type { ApyWindows, EarnRow, VerifiedBlock } from '../types'
import { NULL_TRIPLE, pool } from './earnSnapshot'

installYieldsFixtures()

// The earn artifact rows the current test reads; every call reads them from a fresh generation.
let currentRows: Array<EarnRow> = []
const useRows = (rows: Array<EarnRow>) => {
	currentRows = rows
}

// Access defaults to LOCKED in production; these cases are about what a subscriber sees unless
// they say otherwise, so the helper inverts that default and the locked block passes LOCKED.
const getEarnPage = (
	query: Parameters<typeof getEarnPageFromSnapshot>[1],
	access: Parameters<typeof getEarnPageFromSnapshot>[2] = { verifiedAccess: true }
) => getEarnPageFromSnapshot(yieldsSnapshot({ earn: currentRows }), query, access)

const LOCKED = { verifiedAccess: false } as const

function apyOf(total: number | null): ApyWindows {
	return {
		current: { base: total, reward: null, total },
		avg_7d: NULL_TRIPLE,
		avg_30d: { base: total, reward: null, total }
	}
}

// Deliberately built WITHOUT a `verified` key — the shape of any snapshot generated before
// the API served the field.
function row(id: string, apyTotal: number | null, overrides: Partial<EarnRow> = {}): EarnRow {
	return pool(id, { apy: apyOf(apyTotal), ...overrides })
}

const VERIFIED: VerifiedBlock = {
	apy: { avg_1d: 2.2, avg_7d: 2.3, avg_30d: 2.4 },
	apy_as_of: '2026-08-10T00:00:00.000Z',
	apy_confidence: 'high',
	exit: { status: 'queued', eta_seconds: 950_400, fee_bps: 0, as_of: '2026-08-09' },
	exit_liquidity: { amount: '3037394165014158793', usd: null, slippage_bps: 0, as_of: '2026-08-09' },
	tvl: { amount: '3505252086865604074959333', usd: null, as_of: '2026-08-09' }
}

describe('getEarnPage verified fields', () => {
	// Fixtures are dated 2026-08-10; the freshness gate judges them from the morning after.
	beforeAll(() => vi.setSystemTime(new Date('2026-08-11T06:00:00Z')))
	afterAll(() => vi.useRealTimers())

	// getStaticProps cannot serialize `undefined`, and an upstream row that predates the field
	// has no `verified` key at all — so the absence must be normalized to null, not passed through.
	test('normalizes an absent verified block to null so the page can serialize', async () => {
		useRows([row('a', 5)])

		const { rows } = await getEarnPage({})

		expect(rows[0].verified).toBeNull()
		expect(rows[0].verifiedApy).toBeNull()
		expect(rows[0].reportedApyBase).toBeNull()
		expect(JSON.stringify(rows[0])).toContain('"verified":null')
	})

	test('leaves the reported APY as the headline figure for an unmeasured pool', async () => {
		useRows([row('a', 5)])

		const { rows } = await getEarnPage({})

		expect(rows[0].apy).toBe(5)
	})

	// The measured base BECOMES the headline: one number in the cell, and the same number the
	// sort key, the APY filters and the median run on.
	test('swaps the measured base into the headline APY, keeping the reported one for disclosure', async () => {
		useRows([row('a', 5, { verified: VERIFIED })])

		const monthly = await getEarnPage({})
		// The default window is 30d, so the headline reads avg_30d.
		expect(monthly.rows[0].verifiedApy).toBe(2.4)
		expect(monthly.rows[0].apy).toBe(2.4)
		expect(monthly.rows[0].apyBase).toBe(2.4)
		expect(monthly.rows[0].reportedApyBase).toBe(5)
		expect(monthly.rows[0].verified).toEqual(VERIFIED)

		const weekly = await getEarnPage({ apyWindow: 'avg_7d' })
		// Each window reads the measured figure for that same window.
		expect(weekly.rows[0].verifiedApy).toBe(2.3)
	})

	// The intrinsic leg is the source pool's own yield, so where that pool is measured its reading
	// replaces the reported leg: in the headline, and so in the sort, filters and median.
	test('swaps a measured source pool into the intrinsic leg', async () => {
		const intrinsic = {
			apy: { current: { base: 2.29 }, avg_7d: { base: null }, avg_30d: { base: 2.29 } },
			source_pool: { id: 'weeth', pool_token: null, symbol: 'weETH' }
		}
		useRows([row('weeth', 2.27, { verified: VERIFIED }), row('aweeth', 0.5, { intrinsic })])

		const { rows } = await getEarnPage({ apyComponents: 'base,intrinsic' })
		const held = rows.find((r) => r.id === 'aweeth')!

		expect(held.verifiedIntrinsicApy).toBe(2.4)
		expect(held.reportedIntrinsicApy).toBe(2.29)
		expect(held.resolvedApy.intrinsic).toBe(2.4)
		expect(held.apy).toBeCloseTo(2.9, 6)
		// The pool's own base is still the protocol's figure.
		expect(held.verifiedApy).toBeNull()

		// A locked reader gets the reported leg and no trace of the measurement.
		const locked = await getEarnPage({ apyComponents: 'base,intrinsic' }, LOCKED)
		const lockedRow = locked.rows.find((r) => r.id === 'aweeth')!
		expect(lockedRow.resolvedApy.intrinsic).toBe(2.29)
		expect(lockedRow.apy).toBeCloseTo(2.79, 6)
		expect(lockedRow.verifiedIntrinsicApy).toBeNull()
	})

	// `verified.apy` is base yield only, so emissions still come from the reported figures and
	// still ride on top — comparing it against the reported TOTAL would understate by the whole
	// reward, which reaches 94-118% of the headline on 29 pools.
	test('recomposes the total from the measured base plus the reported reward', async () => {
		const withReward = row('a', null, {
			apy: {
				current: { base: 2.38, reward: 0.45, total: 2.83 },
				avg_7d: NULL_TRIPLE,
				avg_30d: { base: 2.38, reward: 0.45, total: 2.83 }
			},
			reward_tokens: [{ address: '0xabc', symbol: 'MORPHO', decimals: 18 }],
			verified: { ...VERIFIED, apy: { avg_1d: 2.58, avg_7d: null, avg_30d: 2.58 } }
		})
		useRows([withReward])

		// Default components: base + reward.
		const { rows } = await getEarnPage({})

		expect(rows[0].apyBase).toBe(2.58)
		expect(rows[0].apyReward).toBe(0.45)
		expect(rows[0].apy).toBeCloseTo(3.03, 10)
		expect(rows[0].reportedApyBase).toBe(2.38)
	})

	// An unsplit total gives the measurement no base slot to land in. With no reward tokens it is
	// base-only in fact and does get replaced; a pool that pays rewards keeps its reported figure,
	// because dropping a base-only number in would silently delete emissions we cannot separate.
	test('replaces a rewardless unsplit total but leaves one that may hide emissions alone', async () => {
		const unsplit = (id: string, rewardTokens: EarnRow['reward_tokens']) =>
			row(id, null, {
				apy: {
					current: { base: null, reward: null, total: 4.52 },
					avg_7d: NULL_TRIPLE,
					avg_30d: { base: null, reward: null, total: 4.52 }
				},
				reward_tokens: rewardTokens,
				verified: { ...VERIFIED, apy: { avg_1d: 5.68, avg_7d: null, avg_30d: 5.68 } }
			})
		useRows([unsplit('rewardless', []), unsplit('rewarded', [{ address: '0xabc', symbol: 'CVX', decimals: 18 }])])

		const { rows } = await getEarnPage({ sortBy: 'id' })
		const byId = new Map(rows.map((r) => [r.id, r]))

		expect(byId.get('rewardless')!.apy).toBe(5.68)
		expect(byId.get('rewardless')!.reportedApyBase).toBe(4.52)
		expect(byId.get('rewarded')!.apy).toBe(4.52)
		expect(byId.get('rewarded')!.verifiedApy).toBeNull()
		expect(byId.get('rewarded')!.reportedApyBase).toBeNull()
		expect(byId.get('rewarded')!.verifiedUnsubstitutedApy).toBe(5.68)
	})

	// Filtering on the reported figure and then rendering the measured one would hand back rows
	// that visibly fail the filter the user set.
	test('runs the APY range filters on the measured headline', async () => {
		useRows([row('a', 5, { verified: VERIFIED })])

		// Reported 5% passes, measured 2.4% does not.
		expect((await getEarnPage({ minApy: '4' })).rows).toHaveLength(0)
		expect((await getEarnPage({ minApy: '2' })).rows.map((r) => r.id)).toEqual(['a'])
	})

	// Coverage is ~124 of 15k pools, so the filter is the only practical way to find them.
	test('narrows to measured pools when verified=true, and leaves the set alone otherwise', async () => {
		useRows([row('measured', 5, { verified: VERIFIED }), row('unmeasured', 6)])

		const filtered = await getEarnPage({ verified: 'true' })
		expect(filtered.rows.map((r) => r.id)).toEqual(['measured'])

		const unfiltered = await getEarnPage({})
		expect(unfiltered.rows.map((r) => r.id).sort()).toEqual(['measured', 'unmeasured'])
	})

	test('reports null for a measured pool with no reading in the active window', async () => {
		const noSevenDay: VerifiedBlock = {
			...VERIFIED,
			apy: { ...VERIFIED.apy, avg_7d: null }
		}
		useRows([row('a', 5, { verified: noSevenDay })])

		const { rows } = await getEarnPage({ apyWindow: 'avg_7d' })

		expect(rows[0].verifiedApy).toBeNull()
		expect(rows[0].reportedApyBase).toBeNull()
		expect(rows[0].verified).not.toBeNull()
		// Nothing to substitute, so the reported composition passes through untouched — here the
		// fixture reports no 7d window either, so the cell stays empty rather than borrowing a
		// measurement from another window.
		expect(rows[0].apy).toBeNull()
	})

	// The gate is in the NUMBERS, not just the fields: `applyMeasuredBase` never runs for a locked
	// request, so the headline the reader sees is the protocol's own and so is everything derived
	// from it. Stripping the fields but ordering by the measurement would leak it by rank.
	describe('without a subscription', () => {
		test('leaves the reported composition as the headline and the sort key', async () => {
			useRows([row('a', 5, { verified: VERIFIED })])

			const { rows } = await getEarnPage({}, LOCKED)

			expect(rows[0].apy).toBe(5)
			expect(rows[0].apyBase).toBe(5)
		})

		test('runs the APY range filters on the reported figure, so filtered rows match what is shown', async () => {
			useRows([row('a', 5, { verified: VERIFIED })])

			// Measured 2.4% would fail this; reported 5% passes, and 5% is what the cell renders.
			expect((await getEarnPage({ minApy: '4' }, LOCKED)).rows.map((r) => r.id)).toEqual(['a'])
		})

		test('medians the reported figures', async () => {
			useRows([row('a', 5, { verified: VERIFIED }), row('b', 7)])

			expect((await getEarnPage({}, LOCKED)).medianApy).toBe(6)
		})

		test('orders by the reported figure', async () => {
			useRows([row('measured', 5, { verified: VERIFIED }), row('other', 3)])

			const { rows } = await getEarnPage({ sortBy: 'apy', sortDesc: 'true' }, LOCKED)

			// Measured 2.4 would sort this row last; reported 5 puts it first.
			expect(rows.map((r) => r.id)).toEqual(['measured', 'other'])
		})

		// The guard: a field added to the row later must not reach an anonymous reader unnoticed.
		test('serializes no measured value at all, only the fact that one exists', async () => {
			useRows([row('a', 5, { verified: VERIFIED })])

			const { rows } = await getEarnPage({}, LOCKED)
			const wire = JSON.stringify(rows[0])

			expect(rows[0].verifiedLocked).toBe(true)
			expect(rows[0].verifiedUnsubstitutedApy).toBeNull()
			expect(wire).not.toContain('2.4')
			expect(wire).not.toContain('confidence')
			expect(wire).not.toContain('exit_liquidity')
			expect(rows[0].exitStatus).toBeNull()
		})

		// The surfaces that embed these rows in shared HTML — the token page, the RWA asset page —
		// call getEarnPage without an access argument. The default has to be the safe one, or the
		// next such caller leaks the dataset by omission.
		test('locks by default, so a caller that says nothing publishes nothing', async () => {
			useRows([row('a', 5, { verified: VERIFIED })])

			const { rows } = await getEarnPageFromSnapshot(yieldsSnapshot({ earn: currentRows }), {})

			expect(rows[0].verified).toBeNull()
			expect(rows[0].apy).toBe(5)
			expect(rows[0].verifiedLocked).toBe(true)
		})

		// The two tiers must not share a prepared-rows entry: same generation, same filters, one
		// asked with access and one without.
		test('never serves one tier from the prepared cache of the other', async () => {
			useRows([row('a', 5, { verified: VERIFIED })])
			const snapshot = yieldsSnapshot({ earn: currentRows })

			const unlocked = await getEarnPageFromSnapshot(snapshot, {}, { verifiedAccess: true })
			const locked = await getEarnPageFromSnapshot(snapshot, {}, LOCKED)

			expect(unlocked.rows[0].apy).toBe(2.4)
			expect(locked.rows[0].apy).toBe(5)
			expect(locked.rows[0].verified).toBeNull()
		})
	})
})
