import { buildSelectedPercentageChart } from '~/components/ECharts/MultiSeriesChart/selection'
import { CHART_COLORS } from '~/constants/colors'
import {
	buildProtocolBreakdownCsvDataset,
	MAX_PROTOCOL_BREAKDOWN_SERIES,
	type ProtocolBreakdownChart
} from './useProtocolBreakdownCharts'

/**
 * Dominance over the whole breakdown: every series plus the upstream Others. Picks keep their share of that whole, and
 * unpicked series, picks past the top 30 and the upstream Others share one Others band.
 */
export function buildProtocolBreakdownDominance({
	breakdown,
	availableSeries,
	activeSeries,
	aggregateOthers
}: {
	breakdown: ProtocolBreakdownChart
	availableSeries: ReadonlyArray<string>
	activeSeries: ReadonlyArray<string>
	aggregateOthers: boolean
}) {
	const whole = buildProtocolBreakdownCsvDataset({
		breakdown,
		availableSeries,
		activeSeries: availableSeries,
		includeUpstreamOthers: aggregateOthers,
		fillMissingWithZero: true
	})
	return buildSelectedPercentageChart({
		dataset: whole,
		// Same palette slots as the breakdown's line view, so a series keeps its color across views.
		charts: whole.dimensions.slice(1).map((name, index) => ({
			type: 'line',
			name,
			encode: { x: 0, y: index + 1 },
			color: CHART_COLORS[index % CHART_COLORS.length]!
		})),
		selectedCharts: new Set(activeSeries),
		missingValuePolicy: 'sum-available',
		limit: aggregateOthers ? MAX_PROTOCOL_BREAKDOWN_SERIES : Number.POSITIVE_INFINITY
	})
}
