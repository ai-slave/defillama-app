import { describe, expect, it } from 'vitest'
import {
	getBooleanOverride,
	getHolderMode,
	getHolderModeQueryValue,
	getPoolHistoryRange,
	getPoolSeriesQueryKey,
	getRangeQueryValue,
	getSeriesVisibility
} from './queryState'

describe('pool detail query state', () => {
	it('parses periods and holder modes with canonical defaults', () => {
		expect(getPoolHistoryRange('30d')).toBe('30d')
		expect(getPoolHistoryRange(['90d', '30d'])).toBe('90d')
		expect(getPoolHistoryRange('invalid')).toBe('max')
		expect(getHolderMode('balance')).toBe('balance')
		expect(getHolderMode('invalid')).toBe('share')
	})

	it('uses explicit series overrides and otherwise preserves each series default', () => {
		expect(getSeriesVisibility(undefined, true)).toBe(true)
		expect(getSeriesVisibility(undefined, false)).toBe(false)
		expect(getSeriesVisibility('false', true)).toBe(false)
		expect(getSeriesVisibility('true', false)).toBe(true)
		expect(getSeriesVisibility('invalid', true)).toBe(true)
	})

	it('removes default selections from the URL and retains non-default overrides', () => {
		expect(getBooleanOverride(true, true)).toBeUndefined()
		expect(getBooleanOverride(false, true)).toBe('false')
		expect(getBooleanOverride(true, false)).toBe('true')
		expect(getRangeQueryValue('max')).toBeUndefined()
		expect(getRangeQueryValue('90d')).toBe('90d')
		expect(getHolderModeQueryValue('share')).toBeUndefined()
		expect(getHolderModeQueryValue('balance')).toBe('balance')
	})

	it('names supply and borrow series independently', () => {
		expect(getPoolSeriesQueryKey('supply', 'daily')).toBe('supplyDaily')
		expect(getPoolSeriesQueryKey('borrow', 'avg30d')).toBe('borrowAvg30d')
	})
})
