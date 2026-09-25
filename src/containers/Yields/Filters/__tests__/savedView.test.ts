// @vitest-environment happy-dom
import { beforeEach, expect, test } from 'vitest'
import {
	applyStickyPrefs,
	APY_COMPONENTS_PREF,
	APY_WINDOW_PREF,
	TABLE_PAGE_SIZE_PREF,
	YIELDS_TABLE_PREFS
} from '../../stickyQueryPrefs'
import { loadSavedView } from '../savedView'

const stored = () => YIELDS_TABLE_PREFS.map((pref) => localStorage.getItem(pref.storageKey))

beforeEach(() => {
	localStorage.clear()
	localStorage.setItem(APY_WINDOW_PREF.storageKey, 'avg_30d')
	localStorage.setItem(APY_COMPONENTS_PREF.storageKey, 'intrinsic')
	localStorage.setItem(TABLE_PAGE_SIZE_PREF.storageKey, '100')
	localStorage.setItem('unrelated-preference', 'keep')
})

const currentQuery = { apyWindow: 'avg_30d', apyComponents: 'intrinsic', pageSize: '100', page: '3' }

// An undefined value removes that key from the URL, so cleared keys must be present, not omitted.
test.each([
	{
		name: 'omitted defaults',
		filters: { chain: 'Ethereum' },
		query: { chain: 'Ethereum', apyWindow: undefined, apyComponents: undefined, pageSize: undefined, page: undefined },
		prefs: [null, null, null]
	},
	{
		name: 'mixed saved choices',
		filters: { chain: 'Ethereum', apyWindow: 'avg_7d', pageSize: 200 },
		query: { chain: 'Ethereum', apyWindow: 'avg_7d', pageSize: 200, apyComponents: undefined, page: undefined },
		prefs: ['avg_7d', null, '200']
	},
	{
		name: 'explicit defaults',
		filters: { apyWindow: 'current', apyComponents: 'reward', pageSize: 50 },
		query: { apyWindow: 'current', apyComponents: 'reward', pageSize: 50, page: undefined },
		prefs: [null, null, null]
	}
])('loading $name clears other URL keys and stores only its own preferences', ({ filters, query, prefs }) => {
	expect(loadSavedView(filters, currentQuery)).toStrictEqual(query)
	expect(stored()).toEqual(prefs)
	expect(localStorage.getItem('unrelated-preference')).toBe('keep')

	// The landed URL restores nothing stale from storage.
	const landed: Record<string, string> = {}
	for (const key in query) {
		const value = query[key as keyof typeof query]
		if (value !== undefined) landed[key] = String(value)
	}
	expect(applyStickyPrefs(landed, YIELDS_TABLE_PREFS)).toBeNull()
})
