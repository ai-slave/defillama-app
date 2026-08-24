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
	const source: number[][] = new Array(priceHistory.length)
	let targetIndex = priceHistory.length - 1
	// The API is newest-first; filling backward emits chart order without a copied reverse array.
	for (const [date, close] of priceHistory) {
		source[targetIndex] = [Date.parse(date), close]
		targetIndex--
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
	const points = dimensions[metric][period]
	const source: Array<Array<number | null>> = new Array(points.length)
	let targetIndex = points.length - 1
	for (const [date, value] of points) {
		source[targetIndex] = [Date.parse(`${date}T00:00:00Z`), value]
		targetIndex--
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
