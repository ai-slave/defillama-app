import * as React from 'react'

/*
 * A selection kept in React state: which series one chart draws, such as the tokens in a breakdown chart. Use it
 * when the choice only changes what that chart shows. When the choice filters page data (tables, totals, exports)
 * or should survive a reload or a shared link, keep it in the URL through `./query.ts` instead. Never keep a list
 * selection in plain `useState`.
 *
 * - The selection belongs to a `scope`, such as a protocol or chain slug plus the chart. A new scope starts from the
 *   default, so a page that stays mounted while the entity changes never carries picks over. Each scope keeps its
 *   own picks, so returning to a scope shows them again.
 * - Until the user picks, the chart follows the default, including when the options change. Picking exactly the
 *   default goes back to following it.
 * - A pick is stored as intent, like the URL writer: the shorter of "these" (include) or "all except these"
 *   (exclude). After "all except USDT", a series that appears later is shown.
 * - The intent is never rewritten when the options change. The chart shows what it names among the options that
 *   exist now, so a pick that disappears comes back when its option does. When that leaves nothing, the chart shows
 *   the default.
 * - An explicit empty selection stays empty only when `allowEmptySelection` is set; otherwise it shows the first
 *   default.
 */

type SelectionOptions = {
	/** What the selection belongs to: the entity and the chart. A new scope starts from the default. */
	scope: string
	availableSeries: ReadonlyArray<string>
	/** Defaults to every available series. */
	defaultSeries?: ReadonlyArray<string> | undefined
	maxSelectedSeries?: number | undefined
	allowEmptySelection?: boolean | undefined
}

/** The same shape the Stablecoins charts send to their API. */
export type SelectionIntent = { mode: 'include' | 'exclude'; names: Array<string> }

const FIXED_REMAINDER_SERIES_NAME = 'Others'

const uniqueSeries = (series: ReadonlyArray<string>): Array<string> => {
	const unique: Array<string> = []
	const seen = new Set<string>()
	for (const name of series) {
		if (!name || seen.has(name)) continue
		seen.add(name)
		unique.push(name)
	}
	return unique
}

const keepAvailable = (series: ReadonlyArray<string>, available: Set<string>, limit: number): Array<string> => {
	const kept: Array<string> = []
	const seen = new Set<string>()
	for (const name of series) {
		if (kept.length >= limit) break
		if (!available.has(name) || seen.has(name)) continue
		seen.add(name)
		kept.push(name)
	}
	return kept
}

const sameMembers = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
	if (left.length !== right.length) return false
	const rightSet = new Set(right)
	for (const name of left) {
		if (!rightSet.has(name)) return false
	}
	return true
}

/** The series a chart shows for the user's intent (`null` until they pick) and the series available now. */
export function resolveLocalSelection({
	intent,
	availableSeries,
	defaultSeries = availableSeries,
	maxSelectedSeries,
	allowEmptySelection = false
}: Omit<SelectionOptions, 'scope'> & { intent: SelectionIntent | null }): Array<string> {
	const available = uniqueSeries(availableSeries)
	if (available.length === 0) return []
	const availableSet = new Set(available)
	const limit = Math.min(available.length, Math.max(1, maxSelectedSeries ?? available.length))
	const defaults = keepAvailable(defaultSeries, availableSet, limit)
	const firstDefault = defaults.length > 0 ? defaults.slice(0, 1) : available.slice(0, 1)
	// An empty default means the chart starts empty, where the chart allows that.
	const fallback = defaults.length > 0 ? defaults : allowEmptySelection ? [] : firstDefault

	if (intent === null) return fallback
	if (intent.mode === 'include' && intent.names.length === 0) return allowEmptySelection ? [] : firstDefault
	const excluded = intent.mode === 'exclude' ? new Set(intent.names) : null
	const named = excluded ? available.filter((name) => !excluded.has(name)) : intent.names
	const shown = keepAvailable(named, availableSet, limit)
	return shown.length > 0 ? shown : fallback
}

/** Whether the chart shows the default for this intent: before any pick, or when nothing the intent names exists now. */
export function followsDefaultSelection(
	intent: SelectionIntent | null,
	availableSeries: ReadonlyArray<string>
): boolean {
	if (intent === null) return true
	if (availableSeries.length === 0) return false
	if (intent.mode === 'include') {
		if (intent.names.length === 0) return false
		const available = new Set(availableSeries)
		return !intent.names.some((name) => available.has(name))
	}
	const excluded = new Set(intent.names)
	return availableSeries.every((name) => excluded.has(name))
}

/** Stores a selection as the shorter of the two intents over the series available when the user chose. */
export function toSelectionIntent(
	selected: ReadonlyArray<string>,
	availableSeries: ReadonlyArray<string>
): SelectionIntent {
	const chosen = new Set(selected)
	const excluded = uniqueSeries(availableSeries).filter((name) => !chosen.has(name))
	return selected.length > 0 && excluded.length < selected.length
		? { mode: 'exclude', names: excluded }
		: { mode: 'include', names: [...selected] }
}

/** Keeps a newly added series when a capped selection is full, dropping the oldest one instead. */
export function boundSelection(current: ReadonlyArray<string>, next: Array<string>, limit: number): Array<string> {
	if (next.length <= limit) return next
	const added = next.filter((name) => !current.includes(name))
	const [addedName] = added
	if (added.length === 1 && addedName !== undefined) {
		return [...next.filter((name) => name !== addedName).slice(0, limit - 1), addedName]
	}
	return next.slice(0, limit)
}

/**
 * The stored intent for each scope. A scope keeps its own intent, so switching a chart's type and back keeps the
 * picks made for it; a new scope starts from the default. Pages that send the intent to an API read it from here.
 */
export function useSelectionIntent(scope: string) {
	const [intents, setIntents] = React.useState<Record<string, SelectionIntent>>({})
	const intent = intents[scope] ?? null
	const setIntent = React.useCallback(
		(next: SelectionIntent | null | ((current: SelectionIntent | null) => SelectionIntent | null)) => {
			setIntents((current) => {
				const resolved = typeof next === 'function' ? next(current[scope] ?? null) : next
				const updated = { ...current }
				if (resolved === null) delete updated[scope]
				else updated[scope] = resolved
				return updated
			})
		},
		[scope]
	)
	return { intent, setIntent }
}

/** The update to store when the user picks `requested` from what the chart shows now. */
export function pickSelectionIntent({
	intent,
	requested,
	availableSeries,
	defaultSeries,
	maxSelectedSeries,
	allowEmptySelection
}: Omit<SelectionOptions, 'scope'> & {
	intent: SelectionIntent | null
	requested: Array<string>
}): SelectionIntent | null {
	const resolveOptions = { availableSeries, defaultSeries, maxSelectedSeries, allowEmptySelection }
	const shown = resolveLocalSelection({ intent, ...resolveOptions })
	const bounded = maxSelectedSeries ? boundSelection(shown, requested, maxSelectedSeries) : requested
	// Choosing exactly the default goes back to following it as the options change.
	const defaults = resolveLocalSelection({ intent: null, ...resolveOptions })
	if (bounded.length > 0 && sameMembers(bounded, defaults)) return null
	return toSelectionIntent(bounded, availableSeries)
}

export function useLocalSelection({
	scope,
	availableSeries,
	defaultSeries,
	maxSelectedSeries,
	allowEmptySelection = false
}: SelectionOptions) {
	const { intent, setIntent } = useSelectionIntent(scope)
	const activeSeries = React.useMemo(
		() => resolveLocalSelection({ intent, availableSeries, defaultSeries, maxSelectedSeries, allowEmptySelection }),
		[intent, availableSeries, defaultSeries, maxSelectedSeries, allowEmptySelection]
	)

	const setSelectedSeries = React.useCallback<React.Dispatch<React.SetStateAction<Array<string>>>>(
		(next) => {
			setIntent((current) => {
				const resolveOptions = { availableSeries, defaultSeries, maxSelectedSeries, allowEmptySelection }
				const shown = resolveLocalSelection({ intent: current, ...resolveOptions })
				const requested = typeof next === 'function' ? next(shown) : next
				return pickSelectionIntent({ intent: current, requested, ...resolveOptions })
			})
		},
		[availableSeries, defaultSeries, maxSelectedSeries, allowEmptySelection, setIntent]
	)

	const selectedCharts = React.useMemo(() => new Set(activeSeries), [activeSeries])
	// A fallback to the default counts as the default, so charts show their "Others" remainder again.
	const isDefaultSelection = followsDefaultSelection(intent, availableSeries)
	return { activeSeries, selectedCharts, setSelectedSeries, isDefaultSelection }
}

/**
 * For charts whose data carries an "Others" remainder series: the remainder is not selectable, and the chart draws it
 * only while the peers shown are exactly the default ones.
 */
export function useLocalSelectionWithRemainder({ availableSeries, defaultSeries, ...options }: SelectionOptions) {
	const selectableSeries = React.useMemo(
		() => availableSeries.filter((name) => name !== FIXED_REMAINDER_SERIES_NAME),
		[availableSeries]
	)
	const remainderSeries = React.useMemo(
		() => availableSeries.filter((name) => name === FIXED_REMAINDER_SERIES_NAME),
		[availableSeries]
	)
	const selectableDefaults = React.useMemo(
		() => defaultSeries?.filter((name) => name !== FIXED_REMAINDER_SERIES_NAME),
		[defaultSeries]
	)
	const selection = useLocalSelection({
		...options,
		availableSeries: selectableSeries,
		defaultSeries: selectableDefaults
	})
	const renderedCharts = React.useMemo(() => {
		const rendered = new Set(selection.selectedCharts)
		const defaults = resolveLocalSelection({
			intent: null,
			availableSeries: selectableSeries,
			defaultSeries: selectableDefaults,
			maxSelectedSeries: options.maxSelectedSeries
		})
		if (sameMembers(selection.activeSeries, defaults)) {
			for (const name of remainderSeries) rendered.add(name)
		}
		return rendered
	}, [
		options.maxSelectedSeries,
		remainderSeries,
		selectableDefaults,
		selectableSeries,
		selection.activeSeries,
		selection.selectedCharts
	])

	return { ...selection, selectableSeries, renderedCharts }
}
