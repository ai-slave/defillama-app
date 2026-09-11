// @vitest-environment happy-dom

import { Storage } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { POOL_CHART_PREFS, POOL_CHART_WINDOW_PREFS } from '../poolDetail/queryState'
import {
	APY_COMPONENTS_PREF,
	APY_WINDOW_PREF,
	applyStickyPrefs,
	TABLE_PAGE_SIZE_PREF,
	writeStickyPref,
	YIELDS_TABLE_PREFS
} from '../stickyQueryPrefs'

beforeEach(() => vi.stubGlobal('localStorage', new Storage()))
afterEach(() => vi.unstubAllGlobals())

describe('applyStickyPrefs', () => {
	test('fills the keys the URL lacks from valid stored values and keeps the rest of the query', () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		window.localStorage.setItem(TABLE_PAGE_SIZE_PREF.storageKey, '100')
		expect(applyStickyPrefs({ chain: 'Ethereum' }, YIELDS_TABLE_PREFS)).toEqual({
			chain: 'Ethereum',
			apyWindow: 'avg_30d',
			pageSize: '100'
		})
	})

	test('blocked browser storage does not prevent loading', () => {
		vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
			throw new Error('Storage blocked')
		})
		expect(applyStickyPrefs({}, YIELDS_TABLE_PREFS)).toBeNull()
	})

	test('a present key wins over storage', () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
		expect(applyStickyPrefs({ apyWindow: 'avg_7d' }, YIELDS_TABLE_PREFS)).toBeNull()
	})

	test('a retired alias key counts as present', () => {
		window.localStorage.setItem(POOL_CHART_WINDOW_PREFS.supply.storageKey, '7d')
		expect(applyStickyPrefs({ pool: 'abc', supplyAvg30d: 'true' }, POOL_CHART_PREFS)).toBeNull()
		expect(applyStickyPrefs({ pool: 'abc' }, POOL_CHART_PREFS)).toEqual({ pool: 'abc', supplyWindow: '7d' })
	})

	test('ignores default or invalid stored values', () => {
		window.localStorage.setItem(APY_WINDOW_PREF.storageKey, 'current')
		window.localStorage.setItem(APY_COMPONENTS_PREF.storageKey, 'reward')
		window.localStorage.setItem(TABLE_PAGE_SIZE_PREF.storageKey, '50')
		expect(applyStickyPrefs({}, YIELDS_TABLE_PREFS)).toBeNull()
	})
})

describe('writeStickyPref', () => {
	test('stores a non-default value and clears on the default or an invalid value', () => {
		writeStickyPref(APY_WINDOW_PREF, 'avg_7d')
		expect(window.localStorage.getItem(APY_WINDOW_PREF.storageKey)).toBe('avg_7d')
		writeStickyPref(APY_WINDOW_PREF, undefined)
		expect(window.localStorage.getItem(APY_WINDOW_PREF.storageKey)).toBeNull()

		writeStickyPref(TABLE_PAGE_SIZE_PREF, '20')
		expect(window.localStorage.getItem(TABLE_PAGE_SIZE_PREF.storageKey)).toBe('20')
		writeStickyPref(TABLE_PAGE_SIZE_PREF, '50')
		expect(window.localStorage.getItem(TABLE_PAGE_SIZE_PREF.storageKey)).toBeNull()
	})
})

describe('table pref validators accept only valid non-default wire values', () => {
	test.each([
		{ pref: APY_WINDOW_PREF, value: 'avg_7d', expected: true },
		{ pref: APY_WINDOW_PREF, value: 'avg_30d', expected: true },
		{ pref: APY_WINDOW_PREF, value: 'current', expected: false },
		{ pref: APY_COMPONENTS_PREF, value: 'base', expected: true },
		{ pref: APY_COMPONENTS_PREF, value: 'intrinsic', expected: true },
		{ pref: APY_COMPONENTS_PREF, value: 'reward,intrinsic', expected: true },
		{ pref: APY_COMPONENTS_PREF, value: 'reward', expected: false },
		{ pref: TABLE_PAGE_SIZE_PREF, value: '100', expected: true },
		{ pref: TABLE_PAGE_SIZE_PREF, value: '50', expected: false },
		{ pref: TABLE_PAGE_SIZE_PREF, value: '0', expected: false },
		{ pref: TABLE_PAGE_SIZE_PREF, value: '501', expected: false },
		{ pref: TABLE_PAGE_SIZE_PREF, value: '12.5', expected: false },
		{ pref: TABLE_PAGE_SIZE_PREF, value: 'all', expected: false }
	])('$pref.storageKey: $value → $expected', ({ pref, value, expected }) => {
		expect(pref.isValid(value)).toBe(expected)
	})
})
