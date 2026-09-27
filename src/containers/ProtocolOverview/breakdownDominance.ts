import {
	buildPercentageChartDataset,
	buildSelectedPercentageChart
} from '~/components/ECharts/MultiSeriesChart/selection'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildProtocolBreakdownCsvDataset, type ProtocolBreakdownChart } from './useProtocolBreakdownCharts'

export function buildProtocolBreakdownDominance({
	dataset,
	charts,
	selectedCharts,
	breakdown,
	availableSeries,
	activeSeries,
	includeUpstreamOthers
}: {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	selectedCharts: ReadonlySet<string>
	breakdown: ProtocolBreakdownChart
	availableSeries: ReadonlyArray<string>
	activeSeries: ReadonlyArray<string>
	includeUpstreamOthers: boolean
}) {
	const presentation = buildSelectedPercentageChart({
		dataset,
		charts,
		selectedCharts,
		missingValuePolicy: 'sum-available'
	})
	return {
		...presentation,
		csvSource: {
			type: 'dataset' as const,
			prepare: () => {
				// The chart folds picks past the top 30 into Others; the export lists each pick over the same total.
				const picked = buildProtocolBreakdownCsvDataset({
					breakdown,
					availableSeries,
					activeSeries,
					includeUpstreamOthers,
					fillMissingWithZero: true
				})
				return buildPercentageChartDataset({
					dataset: picked,
					charts: picked.dimensions.slice(1).map((name, index) => ({
						type: 'line',
						name,
						encode: { x: 0, y: index + 1 }
					})),
					missingValuePolicy: 'sum-available'
				})
			}
		}
	}
}
