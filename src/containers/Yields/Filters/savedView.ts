import { writeStickyPref, YIELDS_TABLE_PREFS } from '../stickyQueryPrefs'

type SavedViewValue = string | number | boolean | Array<string | number | boolean> | undefined

/**
 * Store the view's sticky preferences, clearing the ones it omits, and return the query that opens it.
 * Storage is written before navigation so restoration on the next render cannot bring back stale choices.
 */
export function loadSavedView(
	filters: Record<string, SavedViewValue>,
	currentQuery: Record<string, unknown>
): Record<string, SavedViewValue> {
	const updates: Record<string, SavedViewValue> = { ...filters }
	for (const key in currentQuery) {
		if (!(key in filters)) updates[key] = undefined
	}
	for (const pref of YIELDS_TABLE_PREFS) {
		const raw = filters[pref.queryKey]
		const value = Array.isArray(raw) ? raw[0] : raw
		writeStickyPref(pref, typeof value === 'string' || typeof value === 'number' ? String(value) : undefined)
	}
	return updates
}
