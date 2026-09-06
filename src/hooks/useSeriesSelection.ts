import * as React from 'react'

interface ReconcileSeriesSelectionOptions {
	availableSeries: ReadonlyArray<string>
	selectedSeries: ReadonlyArray<string> | null
	defaultSeries?: ReadonlyArray<string>
	maxSelectedSeries?: number
	allowEmptySelection?: boolean
	resetToDefaultWhenStale?: boolean
}

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

export function reconcileSeriesSelection({
	availableSeries,
	selectedSeries,
	defaultSeries = availableSeries,
	maxSelectedSeries,
	allowEmptySelection = false,
	resetToDefaultWhenStale = false
}: ReconcileSeriesSelectionOptions): Array<string> {
	const available = uniqueSeries(availableSeries)
	if (available.length === 0) return []
	if (allowEmptySelection && selectedSeries?.length === 0) return []

	const availableSet = new Set(available)
	const limit = Math.min(available.length, Math.max(1, maxSelectedSeries ?? available.length))
	const preferred = selectedSeries ?? defaultSeries
	const reconciled: Array<string> = []
	const selectedSet = new Set<string>()
	for (const name of preferred) {
		if (reconciled.length >= limit) break
		if (!availableSet.has(name) || selectedSet.has(name)) continue
		selectedSet.add(name)
		reconciled.push(name)
	}

	if (reconciled.length > 0) return reconciled
	if (resetToDefaultWhenStale && selectedSeries?.length) {
		for (const name of defaultSeries) {
			if (reconciled.length >= limit) break
			if (!availableSet.has(name) || selectedSet.has(name)) continue
			selectedSet.add(name)
			reconciled.push(name)
		}
		if (reconciled.length > 0) return reconciled
	}

	for (const name of defaultSeries) {
		if (availableSet.has(name)) return [name]
	}
	const firstAvailable = available[0]
	return allowEmptySelection || firstAvailable === undefined ? [] : [firstAvailable]
}

const selectionsEqual = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
	if (left.length !== right.length) return false
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) return false
	}
	return true
}

const selectionsMatch = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
	if (left.length !== right.length) return false
	const rightSet = new Set(right)
	for (const name of left) {
		if (!rightSet.has(name)) return false
	}
	return true
}

export function boundSeriesSelection(
	current: ReadonlyArray<string>,
	next: Array<string>,
	limit: number
): Array<string> {
	if (next.length <= limit) return next
	const addedSeries = next.filter((name) => !current.includes(name))
	if (addedSeries.length === 1) {
		const addedName = addedSeries[0]
		if (addedName !== undefined) {
			return [...next.filter((name) => name !== addedName).slice(0, limit - 1), addedName]
		}
	}
	return next.slice(0, limit)
}

export function useSeriesSelection({
	availableSeries,
	defaultSeries = availableSeries,
	maxSelectedSeries,
	allowEmptySelection = false,
	resetToDefaultWhenStale = false,
	selectionKey = 'default',
	storeDefaultAsIntent = false
}: Omit<ReconcileSeriesSelectionOptions, 'selectedSeries'> & {
	selectionKey?: string
	storeDefaultAsIntent?: boolean
}) {
	const [selectionState, setSelectionState] = React.useState<{ key: string; values: Array<string> } | null>(null)
	const selectedSeries = selectionState?.key === selectionKey ? selectionState.values : null
	const activeSeries = React.useMemo(
		() =>
			reconcileSeriesSelection({
				availableSeries,
				selectedSeries,
				defaultSeries,
				...(maxSelectedSeries === undefined ? {} : { maxSelectedSeries }),
				allowEmptySelection,
				resetToDefaultWhenStale
			}),
		[allowEmptySelection, availableSeries, defaultSeries, maxSelectedSeries, resetToDefaultWhenStale, selectedSeries]
	)

	// Reconciling in render keeps the stored selection consistent with the series that exist now, in the
	// same render the series change, instead of rendering the stale selection once first.
	const reconcileInputs = {
		allowEmptySelection,
		availableSeries,
		defaultSeries,
		maxSelectedSeries,
		resetToDefaultWhenStale,
		selectionKey
	}
	const [syncedInputs, setSyncedInputs] = React.useState(reconcileInputs)
	if (
		syncedInputs.allowEmptySelection !== allowEmptySelection ||
		syncedInputs.availableSeries !== availableSeries ||
		syncedInputs.defaultSeries !== defaultSeries ||
		syncedInputs.maxSelectedSeries !== maxSelectedSeries ||
		syncedInputs.resetToDefaultWhenStale !== resetToDefaultWhenStale ||
		syncedInputs.selectionKey !== selectionKey
	) {
		setSyncedInputs(reconcileInputs)
		setSelectionState((current) => {
			if (current === null || current.key !== selectionKey || availableSeries.length === 0) return current
			const reconciled = reconcileSeriesSelection({
				availableSeries,
				selectedSeries: current.values,
				defaultSeries,
				...(maxSelectedSeries === undefined ? {} : { maxSelectedSeries }),
				allowEmptySelection,
				resetToDefaultWhenStale
			})
			return selectionsEqual(current.values, reconciled) ? current : { key: selectionKey, values: reconciled }
		})
	}

	const setSelectedSeries = React.useCallback<React.Dispatch<React.SetStateAction<Array<string>>>>(
		(next) => {
			setSelectionState((current) => {
				const currentSelection = reconcileSeriesSelection({
					availableSeries,
					selectedSeries: current?.key === selectionKey ? current.values : null,
					defaultSeries,
					...(maxSelectedSeries === undefined ? {} : { maxSelectedSeries }),
					allowEmptySelection,
					resetToDefaultWhenStale
				})
				const nextSelection = typeof next === 'function' ? next(currentSelection) : next
				const boundedSelection = maxSelectedSeries
					? boundSeriesSelection(currentSelection, nextSelection, maxSelectedSeries)
					: nextSelection
				const reconciled = reconcileSeriesSelection({
					availableSeries,
					selectedSeries: boundedSelection,
					defaultSeries,
					...(maxSelectedSeries === undefined ? {} : { maxSelectedSeries }),
					allowEmptySelection,
					resetToDefaultWhenStale
				})
				if (storeDefaultAsIntent) {
					const reconciledDefault = reconcileSeriesSelection({
						availableSeries,
						selectedSeries: null,
						defaultSeries,
						...(maxSelectedSeries === undefined ? {} : { maxSelectedSeries }),
						allowEmptySelection,
						resetToDefaultWhenStale
					})
					if (selectionsMatch(reconciled, reconciledDefault)) return null
				}
				return {
					key: selectionKey,
					values: reconciled
				}
			})
		},
		[
			allowEmptySelection,
			availableSeries,
			defaultSeries,
			maxSelectedSeries,
			resetToDefaultWhenStale,
			selectionKey,
			storeDefaultAsIntent
		]
	)

	const selectedCharts = React.useMemo(() => new Set(activeSeries), [activeSeries])

	return { activeSeries, selectedCharts, setSelectedSeries, isDefaultSelection: selectedSeries === null }
}

/** All peers are the default intent; an explicit subset stays fixed as peers change. */
export function useAllSeriesSelection({
	availableSeries,
	selectionKey = 'default'
}: {
	availableSeries: ReadonlyArray<string>
	selectionKey?: string
}) {
	const [selectionState, setSelectionState] = React.useState<{ key: string; values: Array<string> | null } | null>(null)
	const currentSelection = selectionState?.key === selectionKey ? selectionState.values : null
	const activeSeries = React.useMemo(() => {
		if (currentSelection?.length) {
			const available = new Set(availableSeries)
			if (!currentSelection.some((name) => available.has(name))) return uniqueSeries(availableSeries)
		}
		return reconcileSeriesSelection({
			availableSeries,
			selectedSeries: currentSelection,
			allowEmptySelection: true
		})
	}, [availableSeries, currentSelection])

	// Same reconciliation in render: drop stored series that the current dataset no longer has.
	const [syncedAvailable, setSyncedAvailable] = React.useState({ availableSeries, selectionKey })
	if (syncedAvailable.availableSeries !== availableSeries || syncedAvailable.selectionKey !== selectionKey) {
		setSyncedAvailable({ availableSeries, selectionKey })
		setSelectionState((current) => {
			if (current?.key !== selectionKey || current.values === null || availableSeries.length === 0) return current
			if (current.values.length === 0) return current
			const available = new Set(availableSeries)
			const validValues = current.values.filter((name) => available.has(name))
			if (validValues.length === current.values.length) return current
			return { key: selectionKey, values: validValues.length === 0 ? null : validValues }
		})
	}

	const setSelectedSeries = React.useCallback(
		(values: Array<string>) => {
			const selected = new Set(values)
			const selectsAll = availableSeries.length > 0 && availableSeries.every((name) => selected.has(name))
			setSelectionState({ key: selectionKey, values: selectsAll ? null : values })
		},
		[availableSeries, selectionKey]
	)
	const selectedCharts = React.useMemo(() => new Set(activeSeries), [activeSeries])
	const includeUpstreamOthers = currentSelection === null

	return { activeSeries, selectedCharts, setSelectedSeries, includeUpstreamOthers }
}

export function useSeriesSelectionWithFixedRemainder({
	availableSeries,
	defaultSeries,
	maxSelectedSeries,
	allowEmptySelection = false,
	selectionKey
}: Omit<ReconcileSeriesSelectionOptions, 'selectedSeries'> & { selectionKey?: string }) {
	const selectableSeries = React.useMemo(
		() => availableSeries.filter((name) => name !== FIXED_REMAINDER_SERIES_NAME),
		[availableSeries]
	)
	const remainderSeries = React.useMemo(
		() => availableSeries.filter((name) => name === FIXED_REMAINDER_SERIES_NAME),
		[availableSeries]
	)
	const defaultSelectableSeries = React.useMemo(
		() =>
			reconcileSeriesSelection({
				availableSeries: selectableSeries,
				selectedSeries: null,
				defaultSeries: defaultSeries?.filter((name) => name !== FIXED_REMAINDER_SERIES_NAME) ?? selectableSeries,
				...(maxSelectedSeries === undefined ? {} : { maxSelectedSeries })
			}),
		[defaultSeries, maxSelectedSeries, selectableSeries]
	)
	const selection = useSeriesSelection({
		availableSeries: selectableSeries,
		defaultSeries: defaultSelectableSeries,
		allowEmptySelection,
		...(maxSelectedSeries === undefined ? {} : { maxSelectedSeries }),
		...(selectionKey === undefined ? {} : { selectionKey })
	})
	const renderedCharts = React.useMemo(() => {
		const rendered = new Set(selection.selectedCharts)
		if (selectionsMatch(selection.activeSeries, defaultSelectableSeries)) {
			for (const name of remainderSeries) rendered.add(name)
		}
		return rendered
	}, [defaultSelectableSeries, remainderSeries, selection.activeSeries, selection.selectedCharts])

	return { ...selection, selectableSeries, renderedCharts }
}
