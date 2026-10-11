import type { NextRouter } from 'next/router'
import { pushShallowQuery, toNonEmptyArrayParam } from '~/utils/routerQuery'

/*
 * How a filter picker stores its selection in the URL. The pickers in `./UrlSelect.tsx` write through
 * `getQueryUpdatesFromSelected`, and they and the pages read through `readSelectionFromQuery`, on the client and the
 * server alike, so the checkmarks, rows, requests and exports all see the same selection.
 *
 * - No keys, or an empty value: the picker's default, which is every option unless the picker passes a subset.
 * - `include=All`: every option.
 * - `include=None`: nothing selected; the page shows an empty result.
 * - `include=a&include=b`: those options. Values that are not options are dropped and not counted.
 * - `exclude=c`: every option except those. The writer picks whichever list is shorter, so an exclude list
 *   means exactly the same as including the rest.
 *
 * A selection that only changes what one chart draws, and should not survive a reload, lives in React state through
 * `./localSelection.ts`, which stores intent the same way.
 */

export type ExcludeQueryKey = `exclude${string}`

export const getQueryUpdatesFromSelected = (
	includeKey: string,
	excludeKey: ExcludeQueryKey,
	allKeys: Array<string>,
	// 'None' is a sentinel meaning "nothing selected" — keep it explicit in the type
	values: Array<string> | string | 'None' | null,
	defaultSelectedValues?: Array<string>
): Record<string, string | Array<string> | undefined> => {
	const updates: Record<string, string | Array<string> | undefined> = {}

	const setOrDelete = (key: string, value: string | Array<string> | null) => {
		updates[key] = value === null ? undefined : value
	}

	const validSet = new Set(allKeys)
	const defaultSelected = defaultSelectedValues ? defaultSelectedValues.filter((value) => validSet.has(value)) : null
	const defaultIsAll = !defaultSelected || defaultSelected.length === allKeys.length
	const defaultSelection = defaultSelected ?? allKeys
	const defaultSelectionSet = new Set(defaultSelection)

	let nextValues = values

	// Select all => default (no params)
	if (nextValues === null) {
		if (defaultIsAll) {
			setOrDelete(includeKey, null)
			setOrDelete(excludeKey, null)
			return updates
		}
		nextValues = allKeys
	}

	if (nextValues === 'None') {
		if (defaultSelection.length === 0) {
			setOrDelete(includeKey, null)
			setOrDelete(excludeKey, null)
			return updates
		}
		setOrDelete(includeKey, 'None')
		setOrDelete(excludeKey, null)
		return updates
	}

	// Single-select value: always write include="..."
	if (typeof nextValues === 'string') {
		if (defaultSelected?.length === 1 && defaultSelected[0] === nextValues) {
			setOrDelete(includeKey, null)
			setOrDelete(excludeKey, null)
			return updates
		}
		setOrDelete(includeKey, nextValues)
		setOrDelete(excludeKey, null)
		return updates
	}

	const selected = nextValues.filter((v) => validSet.has(v))
	const selectedSet = new Set(selected)

	// Default selection => no params
	const isDefaultSelection =
		selected.length === defaultSelection.length && selected.every((value) => defaultSelectionSet.has(value))
	if (isDefaultSelection) {
		setOrDelete(includeKey, null)
		setOrDelete(excludeKey, null)
		return updates
	}

	// None selected => explicit sentinel (and clear excludes)
	if (selected.length === 0) {
		setOrDelete(includeKey, 'None')
		setOrDelete(excludeKey, null)
		return updates
	}

	const excluded = allKeys.filter((k) => !selectedSet.has(k))

	// Prefer whichever is shorter; if user deselects only a few from mostly-all, this flips to excludeKey
	const useExclude = excluded.length > 0 && excluded.length < selected.length

	if (useExclude) {
		setOrDelete(includeKey, null) // completely remove includeKey when using excludeKey
		setOrDelete(excludeKey, excluded.length === 1 ? excluded[0] : excluded)
	} else {
		setOrDelete(excludeKey, null)
		setOrDelete(includeKey, selected.length === 1 ? selected[0] : selected)
	}

	return updates
}

export const updateQueryFromSelected = (
	router: NextRouter,
	includeKey: string,
	excludeKey: ExcludeQueryKey,
	allKeys: Array<string>,
	// 'None' is a sentinel meaning "nothing selected" — keep it explicit in the type
	values: Array<string> | string | 'None' | null,
	defaultSelectedValues?: Array<string>,
	options?: {
		resetPage?: boolean
		pushQueryUpdates?: (updates: Record<string, string | Array<string> | undefined>) => void
	}
) => {
	const updates = getQueryUpdatesFromSelected(includeKey, excludeKey, allKeys, values, defaultSelectedValues)
	const payload = options?.resetPage ? { ...updates, page: undefined } : updates
	if (options?.pushQueryUpdates) {
		options.pushQueryUpdates(payload)
		return
	}
	void pushShallowQuery(router, payload)
}

/** Reads the selection that `getQueryUpdatesFromSelected` wrote, in option order. */
export function readSelectionFromQuery<T extends string>(
	query: Readonly<Record<string, string | Array<string> | undefined>>,
	includeKey: string,
	excludeKey: ExcludeQueryKey,
	allKeys: ReadonlyArray<T>,
	defaultSelectedValues: ReadonlyArray<string> = allKeys
): Array<T> {
	const included = toNonEmptyArrayParam(query[includeKey])
	const excluded = new Set<string>(toNonEmptyArrayParam(query[excludeKey]))
	if (included.includes('None')) return []
	if (included.length === 0 && excluded.size === 0) {
		const defaults = new Set<string>(defaultSelectedValues)
		return allKeys.filter((key) => defaults.has(key))
	}
	const picked = included.length > 0 && !included.includes('All') ? new Set<string>(included) : null
	return allKeys.filter((key) => (!picked || picked.has(key)) && !excluded.has(key))
}

/**
 * Tests row values against the selection in `query` without the option list, for servers that filter rows
 * directly. It agrees with `readSelectionFromQuery` for every option; rows with several values pass when any
 * value passes. Returns null when nothing is filtered. Pickers whose default is a subset need the option list:
 * use `readSelectionFromQuery` for them.
 */
export function createSelectionMatcher(
	query: Readonly<Record<string, string | Array<string> | undefined>>,
	includeKey: string,
	excludeKey: ExcludeQueryKey
): ((value: string) => boolean) | null {
	const included = toNonEmptyArrayParam(query[includeKey])
	const excluded = new Set(toNonEmptyArrayParam(query[excludeKey]))
	if (included.includes('None')) return () => false
	const picked = included.length > 0 && !included.includes('All') ? new Set(included) : null
	if (!picked && excluded.size === 0) return null
	return (value) => (!picked || picked.has(value)) && !excluded.has(value)
}
