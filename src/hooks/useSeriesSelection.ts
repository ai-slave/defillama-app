import * as React from 'react'

interface ReconcileSeriesSelectionOptions {
	availableSeries: readonly string[]
	selectedSeries: readonly string[] | null
	defaultSeries?: readonly string[]
	maxSelectedSeries?: number
	allowEmptySelection?: boolean
	resetToDefaultWhenStale?: boolean
}

const FIXED_REMAINDER_SERIES_NAME = 'Others'

const uniqueSeries = (series: readonly string[]): string[] => {
	const unique: string[] = []
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
}: ReconcileSeriesSelectionOptions): string[] {
	const available = uniqueSeries(availableSeries)
	if (available.length === 0) return []
	if (allowEmptySelection && selectedSeries?.length === 0) return []

	const availableSet = new Set(available)
	const limit = Math.min(available.length, Math.max(1, maxSelectedSeries ?? available.length))
	const preferred = selectedSeries ?? defaultSeries
	const reconciled: string[] = []
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
	return [available[0]]
}

const selectionsEqual = (left: readonly string[], right: readonly string[]): boolean => {
	if (left.length !== right.length) return false
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) return false
	}
	return true
}

const selectionsMatch = (left: readonly string[], right: readonly string[]): boolean => {
	if (left.length !== right.length) return false
	const rightSet = new Set(right)
	for (const name of left) {
		if (!rightSet.has(name)) return false
	}
	return true
}

export function boundSeriesSelection(current: readonly string[], next: string[], limit: number): string[] {
	if (next.length <= limit) return next
	const addedSeries = next.filter((name) => !current.includes(name))
	if (addedSeries.length === 1) {
		const addedName = addedSeries[0]
		return [...next.filter((name) => name !== addedName).slice(0, limit - 1), addedName]
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
	const [selectionState, setSelectionState] = React.useState<{ key: string; values: string[] } | null>(null)
	const selectedSeries = selectionState?.key === selectionKey ? selectionState.values : null
	const activeSeries = React.useMemo(
		() =>
			reconcileSeriesSelection({
				availableSeries,
				selectedSeries,
				defaultSeries,
				maxSelectedSeries,
				allowEmptySelection,
				resetToDefaultWhenStale
			}),
		[allowEmptySelection, availableSeries, defaultSeries, maxSelectedSeries, resetToDefaultWhenStale, selectedSeries]
	)

	React.useEffect(() => {
		setSelectionState((current) => {
			if (current === null || current.key !== selectionKey || availableSeries.length === 0) return current
			const reconciled = reconcileSeriesSelection({
				availableSeries,
				selectedSeries: current.values,
				defaultSeries,
				maxSelectedSeries,
				allowEmptySelection,
				resetToDefaultWhenStale
			})
			return selectionsEqual(current.values, reconciled) ? current : { key: selectionKey, values: reconciled }
		})
	}, [allowEmptySelection, availableSeries, defaultSeries, maxSelectedSeries, resetToDefaultWhenStale, selectionKey])

	const setSelectedSeries = React.useCallback<React.Dispatch<React.SetStateAction<string[]>>>(
		(next) => {
			setSelectionState((current) => {
				const currentSelection = reconcileSeriesSelection({
					availableSeries,
					selectedSeries: current?.key === selectionKey ? current.values : null,
					defaultSeries,
					maxSelectedSeries,
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
					maxSelectedSeries,
					allowEmptySelection,
					resetToDefaultWhenStale
				})
				if (storeDefaultAsIntent) {
					const reconciledDefault = reconcileSeriesSelection({
						availableSeries,
						selectedSeries: null,
						defaultSeries,
						maxSelectedSeries,
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
	availableSeries: readonly string[]
	selectionKey?: string
}) {
	const [selectionState, setSelectionState] = React.useState<{ key: string; values: string[] | null } | null>(null)
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

	React.useEffect(() => {
		setSelectionState((current) => {
			if (current?.key !== selectionKey || current.values === null || availableSeries.length === 0) return current
			if (current.values.length === 0) return current
			const available = new Set(availableSeries)
			const validValues = current.values.filter((name) => available.has(name))
			if (validValues.length === current.values.length) return current
			return { key: selectionKey, values: validValues.length === 0 ? null : validValues }
		})
	}, [availableSeries, selectionKey])

	const setSelectedSeries = React.useCallback(
		(values: string[]) => {
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
				maxSelectedSeries
			}),
		[defaultSeries, maxSelectedSeries, selectableSeries]
	)
	const selection = useSeriesSelection({
		availableSeries: selectableSeries,
		defaultSeries: defaultSelectableSeries,
		maxSelectedSeries,
		allowEmptySelection,
		selectionKey
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
