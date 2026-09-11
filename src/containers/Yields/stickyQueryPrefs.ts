import { getStorageItem, removeStorageItem, setStorageItem } from '~/contexts/localStorageStore'
import { DEFAULT_YIELDS_TABLE_PAGE_SIZE, MAX_YIELDS_TABLE_PAGE_SIZE } from './yieldsTableQuery'

// The URL controls the view; storage fills missing parameters. Defaults clear storage.

type QueryRecord = Record<string, string | Array<string> | undefined>

export type StickyQueryPref = {
	queryKey: string
	storageKey: string
	/** Legacy URL keys that override storage. */
	aliasKeys?: ReadonlyArray<string>
	/** Accepts only valid, non-default wire values. */
	isValid: (value: string) => boolean
}

/** Return a query with missing preferences restored, or null if unchanged. */
export function applyStickyPrefs(query: QueryRecord, prefs: ReadonlyArray<StickyQueryPref>): QueryRecord | null {
	let next: QueryRecord | null = null
	for (const pref of prefs) {
		if (query[pref.queryKey] !== undefined) continue
		if (pref.aliasKeys?.some((key) => query[key] !== undefined)) continue
		const stored = getStorageItem(pref.storageKey)
		if (stored == null || !pref.isValid(stored)) continue
		next ??= { ...query }
		next[pref.queryKey] = stored
	}
	return next
}

/** Store valid non-default choices; otherwise clear the preference. */
export function writeStickyPref(pref: StickyQueryPref, value: string | undefined) {
	if (value !== undefined && pref.isValid(value)) setStorageItem(pref.storageKey, value)
	else removeStorageItem(pref.storageKey)
}

export const APY_WINDOW_PREF: StickyQueryPref = {
	queryKey: 'apyWindow',
	storageKey: 'yields-apy-window',
	isValid: (value) => value === 'avg_7d' || value === 'avg_30d'
}

// Non-default outputs of ApyViewControls' encodeComponents.
const APY_COMPONENT_VALUES = new Set(['base', 'intrinsic', 'reward,intrinsic'])

export const APY_COMPONENTS_PREF: StickyQueryPref = {
	queryKey: 'apyComponents',
	storageKey: 'yields-apy-components',
	isValid: (value) => APY_COMPONENT_VALUES.has(value)
}

export const TABLE_PAGE_SIZE_PREF: StickyQueryPref = {
	queryKey: 'pageSize',
	storageKey: 'yields-table-page-size',
	isValid: (value) => {
		const size = Number(value)
		return (
			Number.isInteger(size) &&
			size > 0 &&
			size <= MAX_YIELDS_TABLE_PAGE_SIZE &&
			size !== DEFAULT_YIELDS_TABLE_PAGE_SIZE
		)
	}
}

// Shared by Earn, Borrow and Loop.
export const YIELDS_TABLE_PREFS: ReadonlyArray<StickyQueryPref> = [
	APY_WINDOW_PREF,
	APY_COMPONENTS_PREF,
	TABLE_PAGE_SIZE_PREF
]
