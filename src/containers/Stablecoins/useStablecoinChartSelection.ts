import * as React from 'react'
import { pickSelectionIntent, resolveLocalSelection, type SelectionIntent } from '~/components/Select/localSelection'
import type { StablecoinRuntimeSeries } from './chartSeries'
import type { StablecoinMarketCapSeries } from './marketCapPresentation'

/**
 * Resolves one chart's intent, kept by `useSelectionIntent` so the page can send it to the stablecoins API, against the
 * snapshot or runtime series with the shared local-selection rules.
 */
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
	selectionIntent: SelectionIntent | null
	setSelectionIntent: (intent: SelectionIntent | null) => void
}) {
	const selectableSeries = marketCapSeries?.selectionSeries ?? runtimeSeries.selectableSeries
	const defaultSeries = marketCapSeries?.defaultSeries ?? runtimeSeries.defaultSeries
	const activeSeries = React.useMemo(
		() =>
			resolveLocalSelection({
				intent: selectionIntent,
				availableSeries: selectableSeries,
				defaultSeries,
				allowEmptySelection: true
			}),
		[defaultSeries, selectableSeries, selectionIntent]
	)
	const renderedCharts = React.useMemo(() => {
		const rendered = new Set(activeSeries)
		if (!marketCapSeries && runtimeSeries.renderedSelectableSeries.every((name) => rendered.has(name))) {
			for (const name of runtimeSeries.fixedRemainderSeries) rendered.add(name)
		}
		return rendered
	}, [activeSeries, marketCapSeries, runtimeSeries.fixedRemainderSeries, runtimeSeries.renderedSelectableSeries])
	const setSelectedSeries = React.useCallback(
		(nextSelection: Array<string>) =>
			setSelectionIntent(
				pickSelectionIntent({
					intent: selectionIntent,
					requested: nextSelection,
					availableSeries: selectableSeries,
					defaultSeries,
					allowEmptySelection: true
				})
			),
		[defaultSeries, selectableSeries, selectionIntent, setSelectionIntent]
	)

	return { activeSeries, selectableSeries, renderedCharts, setSelectedSeries }
}
