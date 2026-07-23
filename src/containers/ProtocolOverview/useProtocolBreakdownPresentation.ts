import * as React from 'react'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import {
	buildProtocolBreakdownPresentation,
	MAX_PROTOCOL_BREAKDOWN_SERIES,
	type ProtocolBreakdownChart
} from './useProtocolBreakdownCharts'

const EMPTY_DATASET: MultiSeriesChartDataset = { source: [], dimensions: ['timestamp'] }

export function useProtocolBreakdownPresentation({
	breakdown,
	availableSeries,
	defaultSeries = availableSeries,
	aggregateOthers,
	type,
	stack,
	fillMissingWithZero = false,
	selectionKey = 'default'
}: {
	breakdown: ProtocolBreakdownChart
	availableSeries: string[]
	defaultSeries?: string[]
	aggregateOthers: boolean
	type: 'line' | 'bar'
	stack?: string
	fillMissingWithZero?: boolean
	selectionKey?: string
}) {
	const { activeSeries, setSelectedSeries, isDefaultSelection } = useSeriesSelection({
		availableSeries,
		defaultSeries,
		maxSelectedSeries: aggregateOthers ? undefined : MAX_PROTOCOL_BREAKDOWN_SERIES,
		allowEmptySelection: true,
		resetToDefaultWhenStale: true,
		selectionKey,
		storeDefaultAsIntent: true
	})

	const presentation = React.useMemo(
		() =>
			buildProtocolBreakdownPresentation({
				breakdown,
				availableSeries,
				activeSeries,
				aggregateOthers,
				includeUpstreamOthers: aggregateOthers && isDefaultSelection,
				fillMissingWithZero,
				type,
				stack
			}),
		[activeSeries, aggregateOthers, availableSeries, breakdown, fillMissingWithZero, isDefaultSelection, stack, type]
	)
	const selectedCharts = React.useMemo(
		() => new Set(presentation.charts.map((chart) => chart.name)),
		[presentation.charts]
	)

	return {
		activeSeries,
		setSelectedSeries,
		dataset: presentation.dataset ?? EMPTY_DATASET,
		charts: presentation.charts,
		selectedCharts
	}
}
