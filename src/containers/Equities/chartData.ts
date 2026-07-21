import type {
	EquitiesDimensionMetric,
	EquitiesDimensionPeriod,
	EquitiesPriceHistory,
	IEquitiesDimensionsResponse
} from './api.types'
import type { IEquitiesPriceHistoryChart } from './types'

const FUNDAMENTAL_CHART_LABELS: Record<EquitiesDimensionMetric, string> = {
	revenue: 'Revenue',
	holdersRevenue: 'Holders Revenue',
	earnings: 'Earnings'
}

export function buildPriceHistoryChart(priceHistory: EquitiesPriceHistory): IEquitiesPriceHistoryChart {
	const source: number[][] = []
	// The equities API returns newest-first rows; reverse iteration emits the chart contract in one pass.
	for (let i = priceHistory.length - 1; i >= 0; i--) {
		const point = priceHistory[i]
		source.push([Date.parse(point[0]), point[1]])
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', 'Close']
		},
		charts: [
			{
				type: 'line',
				name: 'Close',
				encode: { x: 'timestamp', y: 'Close' }
			}
		]
	}
}

export function buildEquitiesDimensionsChart(
	dimensions: IEquitiesDimensionsResponse,
	metric: EquitiesDimensionMetric,
	period: EquitiesDimensionPeriod
): IEquitiesPriceHistoryChart {
	const label = FUNDAMENTAL_CHART_LABELS[metric]
	const source: Array<Array<number | null>> = []
	const points = dimensions[metric]?.[period] ?? []
	for (let i = points.length - 1; i >= 0; i--) {
		const point = points[i]
		source.push([Date.parse(`${point[0]}T00:00:00Z`), point[1]])
	}

	return {
		dataset: {
			source,
			dimensions: ['timestamp', label]
		},
		charts: [
			{
				type: 'bar',
				name: label,
				encode: { x: 'timestamp', y: label }
			}
		]
	}
}
