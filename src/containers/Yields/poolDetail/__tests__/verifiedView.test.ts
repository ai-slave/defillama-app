import { describe, expect, test } from 'vitest'
import type { VerifiedBlock } from '../../data/types'
import type { PoolChartModel } from '../poolCharts'
import { EMPTY_POOL_VERIFIED_PROPS, type PoolVerifiedProps } from '../verifiedProps'
import { isPoolVerifiedLocked, resolvePoolVerifiedView } from '../verifiedView'

const PENDING = { hasAccess: false, isDenied: false }
const DENIED = { hasAccess: false, isDenied: true }
const GRANTED = { hasAccess: true, isDenied: false }

const base = { key: 'base', label: 'Base', colorKey: 'accent' as const, values: [3.5], avg7: [3.6], avg30: [3.7] }
const verifiedBar = {
	...base,
	key: 'verifiedApy',
	label: 'Verified Base',
	colorKey: 'verified' as const,
	values: [4.5]
}
function chart(bars: PoolChartModel['bars'], lines: PoolChartModel['lines'] = []): PoolChartModel {
	return { title: 'Supply APY', net: false, dates: [1_701_561_600_000], bars, lines, netLine: null }
}
const measured = { apy: { avg_1d: 4 } } as VerifiedBlock
const PAGE_CLOCK_MS = Date.parse('2026-09-20T12:00:00Z')
const PAID_UPDATED_AT_MS = Date.parse('2026-09-24T12:00:00Z')

function view(overrides: Partial<Parameters<typeof resolvePoolVerifiedView>[0]> = {}) {
	return resolvePoolVerifiedView({
		access: PENDING,
		verifiedLocked: undefined,
		locked: false,
		paid: EMPTY_POOL_VERIFIED_PROPS,
		paidLoading: false,
		fromProps: EMPTY_POOL_VERIFIED_PROPS,
		pageClockMs: PAGE_CLOCK_MS,
		paidUpdatedAtMs: PAID_UPDATED_AT_MS,
		...overrides
	})
}

describe('isPoolVerifiedLocked', () => {
	test('locks a withheld or unconfirmed page, and a seeded page once access is denied', () => {
		expect(isPoolVerifiedLocked(true, false, null)).toBe(true)
		expect(isPoolVerifiedLocked(null, false, null)).toBe(true)
		expect(isPoolVerifiedLocked(undefined, false, measured)).toBe(false)
		expect(isPoolVerifiedLocked(undefined, true, measured)).toBe(true)
		expect(isPoolVerifiedLocked(false, true, null)).toBe(false)
	})
})

describe('resolvePoolVerifiedView notice', () => {
	test('keeps unknown SSR access neutral until the client confirms denial', () => {
		expect(view({ verifiedLocked: null, locked: true, access: PENDING }).notice).toBe('unavailable')
		expect(view({ verifiedLocked: null, locked: true, access: DENIED }).notice).toBe('offer')
	})

	test('keeps the anonymous SSR offer while client auth initializes', () => {
		expect(view({ verifiedLocked: true, locked: true, access: PENDING }).notice).toBe('offer')
	})

	test('shows a subscriber the unavailable copy only after the paid fetch settles', () => {
		expect(view({ verifiedLocked: null, locked: true, access: GRANTED, paidLoading: true }).notice).toBeNull()
		expect(view({ verifiedLocked: null, locked: true, access: GRANTED }).notice).toBe('unavailable')
	})

	test('never offers the upgrade to a subscriber whose paid fetch came back empty', () => {
		expect(view({ verifiedLocked: true, locked: true, access: GRANTED }).notice).toBeNull()
	})

	test('shows no notice once a measurement is present', () => {
		const paid: PoolVerifiedProps = { ...EMPTY_POOL_VERIFIED_PROPS, verified: measured }
		expect(view({ verifiedLocked: true, locked: true, access: GRANTED, paid }).notice).toBeNull()
	})
})

describe('resolvePoolVerifiedView sections', () => {
	const seededChart = chart([verifiedBar, base])
	const fromProps: PoolVerifiedProps = { ...EMPTY_POOL_VERIFIED_PROPS, verified: measured, supplyChart: seededChart }

	test('keeps seeded measurements while access is pending or granted, and drops them on denial', () => {
		expect(view({ fromProps, access: PENDING })).toMatchObject({ verified: measured, supplyChart: seededChart })
		expect(view({ fromProps, access: GRANTED })).toMatchObject({ verified: measured, supplyChart: seededChart })
		expect(view({ fromProps, access: DENIED })).toMatchObject({ verified: null, supplyChart: chart([base]) })
	})

	test('uses the paid sections in place of redacted props, keeping the page TVL label', () => {
		const paidChart = chart([verifiedBar], [{ key: 'tvl', label: 'TVL', unit: 'usd', values: [1] } as never])
		const paid: PoolVerifiedProps = {
			...EMPTY_POOL_VERIFIED_PROPS,
			liquidityDecimals: 18,
			supplyChart: paidChart
		}
		const pageChart = chart([base], [{ key: 'tvl', label: 'stETH TVL', unit: 'usd', values: [1] } as never])

		const result = view({ access: GRANTED, paid, fromProps: { ...EMPTY_POOL_VERIFIED_PROPS, supplyChart: pageChart } })

		expect(result.liquidityDecimals).toBe(18)
		expect(result.supplyChart?.bars).toEqual([verifiedBar])
		expect(result.supplyChart?.lines.map((line) => line.label)).toEqual(['stETH TVL'])
	})

	test('dates seeded sections by the page build and fetched ones by the paid fetch', () => {
		expect(view({ fromProps, access: GRANTED })).toMatchObject({
			verifiedClockMs: PAGE_CLOCK_MS,
			supplyChartClockMs: PAGE_CLOCK_MS
		})
		const paid: PoolVerifiedProps = { ...EMPTY_POOL_VERIFIED_PROPS, verified: measured, supplyChart: seededChart }
		const redacted: PoolVerifiedProps = { ...EMPTY_POOL_VERIFIED_PROPS, supplyChart: chart([base]) }
		expect(view({ fromProps: redacted, access: GRANTED, paid })).toMatchObject({
			verifiedClockMs: PAID_UPDATED_AT_MS,
			supplyChartClockMs: PAID_UPDATED_AT_MS
		})
	})
})
