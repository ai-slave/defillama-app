import * as React from 'react'
import type { StablecoinRuntimeSeries, StablecoinSeriesSelectionIntent } from './chartSeries'
import type { StablecoinMarketCapSeries } from './marketCapPresentation'

function reconcileStablecoinSelection({
	availableSeries,
	selectedSeries,
	defaultSeries,
	fallbackToDefault
}: {
	availableSeries: readonly string[]
	selectedSeries: readonly string[] | null
	defaultSeries: readonly string[]
	fallbackToDefault: boolean
}) {
	if (availableSeries.length === 0 || selectedSeries?.length === 0) return []
	const available = new Set(availableSeries)
	const preferred = selectedSeries ?? defaultSeries
	const reconciled: string[] = []
	const included = new Set<string>()
	for (const name of preferred) {
		if (!available.has(name) || included.has(name)) continue
		included.add(name)
		reconciled.push(name)
	}
	if (reconciled.length > 0) return reconciled
	if (selectedSeries && !fallbackToDefault) return []
	for (const name of defaultSeries) {
		if (!available.has(name) || included.has(name)) continue
		included.add(name)
		reconciled.push(name)
	}
	return reconciled
}

export function useStablecoinSelectionIntent(selectionKey: string) {
	const [selectionByKey, setSelectionByKey] = React.useState<Record<string, StablecoinSeriesSelectionIntent>>({})
	const selectionIntent = selectionByKey[selectionKey] ?? null
	const setSelectionIntent = React.useCallback(
		(intent: StablecoinSeriesSelectionIntent) =>
			setSelectionByKey((current) => ({ ...current, [selectionKey]: intent })),
		[selectionKey]
	)
	return { selectionIntent, setSelectionIntent }
}

/** Resolve one controlled intent against the active snapshot or runtime payload. */
export function useStablecoinChartSelection({
	marketCapSeries,
	runtimeSeries,
	selectionIntent,
	setSelectionIntent
}: {
	marketCapSeries: StablecoinMarketCapSeries | null
	runtimeSeries: Pick<
		StablecoinRuntimeSeries,
		'selectableSeries' | 'defaultSeries' | 'renderedSelectableSeries' | 'fixedRemainderSeries'
	>
	selectionIntent: StablecoinSeriesSelectionIntent
	setSelectionIntent: (intent: StablecoinSeriesSelectionIntent) => void
}) {
	const selectableSeries = marketCapSeries?.selectionSeries ?? runtimeSeries.selectableSeries
	const defaultSeries = marketCapSeries?.defaultSeries ?? runtimeSeries.defaultSeries
	const selectedNames = React.useMemo(() => {
		if (!selectionIntent) return null
		if (selectionIntent.mode === 'include') return selectionIntent.names
		const excluded = new Set(selectionIntent.names)
		return selectableSeries.filter((name) => !excluded.has(name))
	}, [selectableSeries, selectionIntent])
	const reconciledSeries = React.useMemo(
		() =>
			reconcileStablecoinSelection({
				availableSeries: selectableSeries,
				selectedSeries: selectedNames,
				defaultSeries,
				fallbackToDefault: marketCapSeries != null
			}),
		[defaultSeries, marketCapSeries, selectableSeries, selectedNames]
	)
	const activeSeries = reconciledSeries
	const renderedCharts = React.useMemo(() => {
		const rendered = new Set(activeSeries)
		if (!marketCapSeries && runtimeSeries.renderedSelectableSeries.every((name) => rendered.has(name))) {
			for (const name of runtimeSeries.fixedRemainderSeries) rendered.add(name)
		}
		return rendered
	}, [activeSeries, marketCapSeries, runtimeSeries.fixedRemainderSeries, runtimeSeries.renderedSelectableSeries])
	const setSelectedSeries = React.useCallback(
		(nextSelection: string[]) => {
			const selected = new Set(nextSelection)
			const selectsDefault =
				nextSelection.length === defaultSeries.length && defaultSeries.every((name) => selected.has(name))
			if (selectsDefault) {
				setSelectionIntent(null)
				return
			}
			const excludedNames = selectableSeries.filter((name) => !selected.has(name))
			setSelectionIntent(
				nextSelection.length <= excludedNames.length
					? { mode: 'include', names: nextSelection }
					: { mode: 'exclude', names: excludedNames }
			)
		},
		[defaultSeries, selectableSeries, setSelectionIntent]
	)

	return { activeSeries, selectableSeries, renderedCharts, setSelectedSeries }
}
