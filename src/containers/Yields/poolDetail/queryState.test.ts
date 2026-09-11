import { describe, expect, test } from 'vitest'
import {
	getBooleanOverride,
	getGrowthAnchorDate,
	getGrowthDeposit,
	getGrowthDepositQueryValue,
	getHolderMode,
	getHolderModeQueryValue,
	getPoolHistoryRange,
	getPoolRange,
	getPoolSeriesQueryKey,
	getRangeQueryValue,
	getPoolChartWindow,
	getPoolRangeQueryKey,
	getSeriesVisibility,
	getWindowQueryPatch,
	getWindowQueryValue,
	GROWTH_MAX_DEPOSIT,
	POOL_CHART_PREFS,
	POOL_CHART_RANGE_PREFS,
	POOL_CHART_WINDOW_PREFS,
	slicePoolHistory,
	widestPoolRange
} from './queryState'

describe('pool detail query state', () => {
	test('parses periods and holder modes with canonical defaults', () => {
		expect(getPoolHistoryRange('30d')).toBe('30d')
		expect(getPoolHistoryRange(['90d', '30d'])).toBe('90d')
		expect(getPoolHistoryRange('invalid')).toBe('max')
		expect(getHolderMode('balance')).toBe('balance')
		expect(getHolderMode('invalid')).toBe('share')
	})

	test('uses explicit series overrides and otherwise preserves each series default', () => {
		expect(getSeriesVisibility(undefined, true)).toBe(true)
		expect(getSeriesVisibility(undefined, false)).toBe(false)
		expect(getSeriesVisibility('false', true)).toBe(false)
		expect(getSeriesVisibility('true', false)).toBe(true)
		expect(getSeriesVisibility('invalid', true)).toBe(true)
	})

	test('removes default selections from the URL and retains non-default overrides', () => {
		expect(getBooleanOverride(true, true)).toBeUndefined()
		expect(getBooleanOverride(false, true)).toBe('false')
		expect(getBooleanOverride(true, false)).toBe('true')
		expect(getRangeQueryValue('max')).toBeUndefined()
		expect(getRangeQueryValue('90d')).toBe('90d')
		expect(getHolderModeQueryValue('share')).toBeUndefined()
		expect(getHolderModeQueryValue('balance')).toBe('balance')
	})

	test('keeps one range per chart in the URL, the supply chart on the bare key it always had', () => {
		expect(getPoolRangeQueryKey('supply')).toBe('range')
		expect(getPoolRangeQueryKey('borrow')).toBe('borrowRange')
		expect(getPoolRangeQueryKey('growth')).toBe('growthRange')
		expect(getPoolRangeQueryKey('liquidity')).toBe('liquidityRange')
	})

	test('inherits the legacy supply range for borrow until borrowRange is explicit', () => {
		expect(getPoolRange({ range: '30d' }, 'borrow')).toBe('30d')
		expect(getPoolRange({ range: '30d', borrowRange: '90d' }, 'borrow')).toBe('90d')
		expect(getPoolRange({}, 'borrow')).toBe('max')
		expect(getPoolRange({ range: '30d' }, 'growth')).toBe('max')
	})

	test('finds the widest range so one history fetch can serve every chart that reads it', () => {
		expect(widestPoolRange(['30d', 'max', '90d'])).toBe('max')
		expect(widestPoolRange(['30d', '90d'])).toBe('90d')
		expect(widestPoolRange(['30d'])).toBe('30d')
	})

	test('slices one max history locally for nested ranges', () => {
		const history = Array.from({ length: 120 }, (_, index) => ({ date: String(index) })) as never
		expect(slicePoolHistory(history, '30d')).toHaveLength(30)
		expect(slicePoolHistory(history, '90d')).toHaveLength(90)
		expect(slicePoolHistory(history, 'max')).toBe(history)
	})

	test('names supply and borrow series independently', () => {
		expect(getPoolSeriesQueryKey('supply', 'daily')).toBe('supplyDaily')
		expect(getPoolSeriesQueryKey('borrow', 'window')).toBe('borrowWindow')
	})

	test('resolves the chart smoothing window with daily as the silent default', () => {
		// Daily is the default and stays out of the URL.
		expect(getPoolChartWindow(undefined)).toBe('daily')
		expect(getPoolChartWindow('7d')).toBe('7d')
		expect(getPoolChartWindow('30d')).toBe('30d')
		expect(getPoolChartWindow('bogus')).toBe('daily')
		expect(getPoolChartWindow(['30d', '7d'])).toBe('30d')
		expect(getWindowQueryValue('daily')).toBeUndefined()
		expect(getWindowQueryValue('7d')).toBe('7d')
		expect(getWindowQueryValue('30d')).toBe('30d')
	})

	// A legacy avg toggle left in the URL would otherwise win over a fresh daily selection.
	test('a window change clears the retired averaging toggles', () => {
		expect(getWindowQueryPatch('supply', 'daily')).toEqual({
			supplyWindow: undefined,
			supplyAvg7d: undefined,
			supplyAvg30d: undefined
		})
		expect(getWindowQueryPatch('borrow', '30d')).toEqual({
			borrowWindow: '30d',
			borrowAvg7d: undefined,
			borrowAvg30d: undefined
		})
	})

	test('accepts only a bare calendar day as the growth anchor', () => {
		expect(getGrowthAnchorDate('2026-01-31')).toBe('2026-01-31')
		expect(getGrowthAnchorDate(['2026-01-31', '2026-02-01'])).toBe('2026-01-31')
		expect(getGrowthAnchorDate(undefined)).toBeNull()
		expect(getGrowthAnchorDate('yesterday')).toBeNull()
		expect(getGrowthAnchorDate('2026-01-31T12:00:00Z')).toBeNull()
		// Well-formed but not a real day.
		expect(getGrowthAnchorDate('2026-13-45')).toBeNull()
	})

	test('falls back to a $1 deposit for anything unusable, and caps the absurd', () => {
		expect(getGrowthDeposit('10000')).toBe(10_000)
		expect(getGrowthDeposit('2.5')).toBe(2.5)
		expect(getGrowthDeposit(undefined)).toBe(1)
		expect(getGrowthDeposit('')).toBe(1)
		expect(getGrowthDeposit('abc')).toBe(1)
		expect(getGrowthDeposit('0')).toBe(1)
		expect(getGrowthDeposit('-100')).toBe(1)
		expect(getGrowthDeposit('Infinity')).toBe(1)
		expect(getGrowthDeposit('1e30')).toBe(GROWTH_MAX_DEPOSIT)
	})

	test('keeps the default deposit out of the URL', () => {
		expect(getGrowthDepositQueryValue(1)).toBeUndefined()
		expect(getGrowthDepositQueryValue(10_000)).toBe('10000')
	})
})

describe('sticky pool chart prefs', () => {
	test('mirror the URL parsers and never accept a default', () => {
		expect(POOL_CHART_RANGE_PREFS.supply.queryKey).toBe('range')
		expect(POOL_CHART_RANGE_PREFS.borrow.queryKey).toBe('borrowRange')
		// One stored range serves both APY charts; the borrow chart still honours a bare `range` deep link.
		expect(POOL_CHART_RANGE_PREFS.borrow.storageKey).toBe(POOL_CHART_RANGE_PREFS.supply.storageKey)
		expect(POOL_CHART_RANGE_PREFS.borrow.aliasKeys).toEqual(['range'])
		expect(POOL_CHART_RANGE_PREFS.supply.isValid('30d')).toBe(true)
		expect(POOL_CHART_RANGE_PREFS.supply.isValid('90d')).toBe(true)
		expect(POOL_CHART_RANGE_PREFS.supply.isValid('max')).toBe(false)

		expect(POOL_CHART_WINDOW_PREFS.borrow.queryKey).toBe('borrowWindow')
		expect(POOL_CHART_WINDOW_PREFS.borrow.aliasKeys).toEqual(['borrowAvg7d', 'borrowAvg30d'])
		expect(POOL_CHART_WINDOW_PREFS.supply.isValid('7d')).toBe(true)
		expect(POOL_CHART_WINDOW_PREFS.supply.isValid('30d')).toBe(true)
		expect(POOL_CHART_WINDOW_PREFS.supply.isValid('daily')).toBe(false)

		expect(POOL_CHART_PREFS).toEqual([
			POOL_CHART_RANGE_PREFS.supply,
			POOL_CHART_RANGE_PREFS.borrow,
			POOL_CHART_WINDOW_PREFS.supply,
			POOL_CHART_WINDOW_PREFS.borrow
		])
	})
})
