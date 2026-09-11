import { describe, expect, test } from 'vitest'
import {
	getBooleanOverride,
	getHolderMode,
	getHolderModeQueryValue,
	getPoolHistoryRange,
	getPoolSeriesQueryKey,
	getRangeQueryValue,
	getSeriesVisibility,
	getPoolChartWindow,
	getWindowQueryValue,
	POOL_CHART_PREFS,
	POOL_CHART_RANGE_PREF,
	POOL_CHART_WINDOW_PREFS
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

	test('names supply and borrow series independently', () => {
		expect(getPoolSeriesQueryKey('supply', 'daily')).toBe('supplyDaily')
		expect(getPoolSeriesQueryKey('borrow', 'window')).toBe('borrowWindow')
	})

	test('resolves the chart smoothing window with daily as the silent default', () => {
		expect(getPoolChartWindow(undefined)).toBe('daily')
		expect(getPoolChartWindow('7d')).toBe('7d')
		expect(getPoolChartWindow('30d')).toBe('30d')
		expect(getPoolChartWindow('bogus')).toBe('daily')
		expect(getPoolChartWindow(['30d', '7d'])).toBe('30d')
		expect(getWindowQueryValue('daily')).toBeUndefined()
		expect(getWindowQueryValue('7d')).toBe('7d')
		expect(getWindowQueryValue('30d')).toBe('30d')
	})
})

describe('sticky pool chart prefs', () => {
	test('mirror the URL parsers and never accept a default', () => {
		expect(POOL_CHART_RANGE_PREF.queryKey).toBe('range')
		expect(POOL_CHART_RANGE_PREF.isValid('30d')).toBe(true)
		expect(POOL_CHART_RANGE_PREF.isValid('90d')).toBe(true)
		expect(POOL_CHART_RANGE_PREF.isValid('max')).toBe(false)

		expect(POOL_CHART_WINDOW_PREFS.borrow.queryKey).toBe('borrowWindow')
		expect(POOL_CHART_WINDOW_PREFS.borrow.aliasKeys).toEqual(['borrowAvg7d', 'borrowAvg30d'])
		expect(POOL_CHART_WINDOW_PREFS.supply.isValid('7d')).toBe(true)
		expect(POOL_CHART_WINDOW_PREFS.supply.isValid('30d')).toBe(true)
		expect(POOL_CHART_WINDOW_PREFS.supply.isValid('daily')).toBe(false)

		expect(POOL_CHART_PREFS).toEqual([
			POOL_CHART_RANGE_PREF,
			POOL_CHART_WINDOW_PREFS.supply,
			POOL_CHART_WINDOW_PREFS.borrow
		])
	})
})
