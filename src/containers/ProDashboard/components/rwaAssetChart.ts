import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import type { RWAOverviewChartMetric } from '../types'

export const RWA_ASSET_METRIC_DIMENSIONS: Record<RWAOverviewChartMetric, string> = {
	activeMcap: 'Active Mcap',
	onChainMcap: 'Onchain Mcap',
	defiActiveTvl: 'DeFi Active TVL'
}

export function buildProRwaAssetChartSeries(
	dataset: RWAPositionalChartDataset | null,
	metrics: ReadonlyArray<RWAOverviewChartMetric>
): Array<MultiSeriesChartSeriesConfig> {
	if (!dataset) return []

	const selectedDimensions = new Set(metrics.map((metric) => RWA_ASSET_METRIC_DIMENSIONS[metric]))
	const charts: Array<MultiSeriesChartSeriesConfig> = []
	for (let dimensionIndex = 1; dimensionIndex < dataset.dimensions.length; dimensionIndex++) {
		const name = dataset.dimensions[dimensionIndex]
		if (!selectedDimensions.has(name)) continue
		charts.push({
			type: 'line',
			name,
			encode: { x: 0, y: dimensionIndex },
			color: CHART_COLORS[charts.length]
		})
	}
	return charts
}

export function projectRwaAssetDatasetToMetrics(
	dataset: RWAPositionalChartDataset,
	metrics: ReadonlyArray<RWAOverviewChartMetric>
): RWAPositionalChartDataset {
	const selected = new Set(metrics.map((metric) => RWA_ASSET_METRIC_DIMENSIONS[metric]))
	const indexes = dataset.dimensions.flatMap((name, index) => (index > 0 && selected.has(name) ? [index] : []))
	return {
		dimensions: ['timestamp', ...indexes.map((index) => dataset.dimensions[index])],
		source: dataset.source.map((row) => [row[0], ...indexes.map((index) => row[index])])
	}
}
