import {
	buildCompletePercentageChartDataset,
	buildSelectedPercentageChart
} from '~/components/ECharts/MultiSeriesChart/selection'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildCompleteProtocolBreakdownDataset, type ProtocolBreakdownChart } from './useProtocolBreakdownCharts'

export function buildProtocolBreakdownDominance({
	dataset,
	charts,
	selectedCharts,
	breakdown,
	availableSeries,
	aggregateOthers
}: {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	selectedCharts: ReadonlySet<string>
	breakdown: ProtocolBreakdownChart
	availableSeries: ReadonlyArray<string>
	aggregateOthers: boolean
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
				// Export from canonical peers before selection and the visual top-30 fold.
				const complete = buildCompleteProtocolBreakdownDataset({
					breakdown,
					availableSeries,
					includeUpstreamOthers: aggregateOthers,
					fillMissingWithZero: true
				})
				if (!complete) return { dimensions: ['timestamp'], source: [] }
				return buildCompletePercentageChartDataset({
					dataset: complete,
					charts: complete.dimensions.slice(1).map((name, index) => ({
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
