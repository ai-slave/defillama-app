import * as React from 'react'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { useLocalSelection } from '~/components/Select/localSelection'
import {
	buildProtocolBreakdownPresentation,
	MAX_PROTOCOL_BREAKDOWN_SERIES,
	type ProtocolBreakdownChart
} from './useProtocolBreakdownCharts'

const EMPTY_DATASET: TimestampDataset = { source: [], dimensions: ['timestamp'] }

export function useProtocolBreakdownPresentation({
	breakdown,
	availableSeries,
	defaultSeries = availableSeries,
	aggregateOthers,
	type,
	stack,
	fillMissingWithZero = false,
	scope
}: {
	breakdown: ProtocolBreakdownChart
	availableSeries: Array<string>
	defaultSeries?: Array<string>
	aggregateOthers: boolean
	type: 'line' | 'bar'
	stack?: string
	fillMissingWithZero?: boolean
	/** What the selection belongs to, such as the protocol and the chart. */
	scope: string
}) {
	const { activeSeries, setSelectedSeries, isDefaultSelection } = useLocalSelection({
		availableSeries,
		defaultSeries,
		...(aggregateOthers ? {} : { maxSelectedSeries: MAX_PROTOCOL_BREAKDOWN_SERIES }),
		allowEmptySelection: true,
		scope
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
				...(stack === undefined ? {} : { stack })
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
		isDefaultSelection,
		dataset: presentation.dataset ?? EMPTY_DATASET,
		charts: presentation.charts,
		selectedCharts,
		csvSource: presentation.csvSource
	}
}
